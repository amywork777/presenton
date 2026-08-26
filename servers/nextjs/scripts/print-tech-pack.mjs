import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");

const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sourceUrl =
  process.argv[2] ?? "http://127.0.0.1:5190/tech-pack-spike/print";
const outputPath = resolve(process.argv[3] ?? "../../tech-pack-spike.pdf");
const debuggingPort = 9300 + (process.pid % 500);
const profileDirectory = mkdtempSync(`${tmpdir()}/vizcom-tech-pack-chrome-`);

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDirectory}`,
    sourceUrl,
  ],
  { stdio: "ignore" },
);

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function pageTarget() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      const targets = await response.json();
      const page = targets.find(
        (target) => target.type === "page" && target.url.startsWith(sourceUrl),
      );
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome may still be starting.
    }
    await delay(150);
  }
  throw new Error(`Timed out opening ${sourceUrl}`);
}

async function printPage(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let commandId = 0;

  socket.on("message", (payload) => {
    const message = JSON.parse(String(payload));
    const command = pending.get(message.id);
    if (!command) return;
    pending.delete(message.id);
    if (message.error) command.reject(new Error(message.error.message));
    else command.resolve(message.result);
  });

  await new Promise((resolveOpen, rejectOpen) => {
    socket.once("open", resolveOpen);
    socket.once("error", rejectOpen);
  });

  const send = (method, params = {}) =>
    new Promise((resolveCommand, rejectCommand) => {
      commandId += 1;
      pending.set(commandId, { resolve: resolveCommand, reject: rejectCommand });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await delay(1_800);
  const result = await send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
  });
  socket.close();
  return result.data;
}

try {
  await pageTarget();
  await delay(2_500);
  const target = await pageTarget();
  const pdfData = await printPage(target.webSocketDebuggerUrl);
  writeFileSync(outputPath, pdfData, "base64");
  process.stdout.write(`${outputPath}\n`);
} finally {
  chrome.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => chrome.once("exit", resolveExit)),
    delay(2_000),
  ]);
  try {
    rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // The temporary Chrome profile is safe to leave for the OS to reap if a
    // cache writer outlives the headless browser process briefly.
  }
}
