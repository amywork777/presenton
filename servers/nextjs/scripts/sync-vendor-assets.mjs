import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextjsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repositoryRoot = path.resolve(nextjsRoot, "..", "..");

const assets = [
  {
    source: "node_modules/@tailwindcss/browser/dist/index.global.js",
    destination: "tailwindcss-browser.js",
  },
  {
    source: "node_modules/chart.js/dist/chart.umd.min.js",
    destination: "chart.umd.min.js",
  },
  {
    source:
      "node_modules/chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.min.js",
    destination: "chartjs-plugin-datalabels.min.js",
  },
  {
    source: "node_modules/@tailwindcss/browser/LICENSE",
    destination: "tailwindcss-browser.LICENSE.txt",
  },
  {
    source: "node_modules/chart.js/LICENSE.md",
    destination: "chartjs.LICENSE.txt",
  },
  {
    source: "node_modules/chartjs-plugin-datalabels/LICENSE.md",
    destination: "chartjs-plugin-datalabels.LICENSE.txt",
  },
];

const destinations = [
  path.join(nextjsRoot, "public", "vendor"),
  path.join(repositoryRoot, "servers", "fastapi", "static", "vendor"),
];

for (const destinationRoot of destinations) {
  await mkdir(destinationRoot, { recursive: true });

  for (const asset of assets) {
    await copyFile(
      path.join(nextjsRoot, asset.source),
      path.join(destinationRoot, asset.destination)
    );
  }
}

console.log(
  `[vendor-assets] Synced ${assets.length} files to ${destinations
    .map((destination) => path.relative(repositoryRoot, destination))
    .join(" and ")}`
);
