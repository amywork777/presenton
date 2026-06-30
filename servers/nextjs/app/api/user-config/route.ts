import { NextResponse } from "next/server";
import { LLMConfig } from "@/types/llm_config";
import {
  readUserConfigFile,
  updateUserConfigFile,
} from "@/lib/user-config-store";

const canChangeKeys = process.env.CAN_CHANGE_KEYS !== "false";
const AUTH_FIELDS = new Set([
  "AUTH_USERNAME",
  "AUTH_PASSWORD_HASH",
  "AUTH_SECRET_KEY",
  "CODEX_ACCESS_TOKEN",
  "CODEX_REFRESH_TOKEN",
  "CODEX_TOKEN_EXPIRES",
  "CODEX_ACCOUNT_ID",
  "CODEX_USERNAME",
  "CODEX_EMAIL",
  "CODEX_IS_PRO",
]);

function stripAuthFields(config: Record<string, unknown>) {
  const sanitized = { ...config };
  for (const key of AUTH_FIELDS) {
    delete sanitized[key];
  }
  return sanitized;
}

function stripAuthFieldsFromIncoming(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !AUTH_FIELDS.has(key))
  );
}

function getUserConfigPath() {
  return process.env.USER_CONFIG_PATH;
}

async function readConfigBody(request: Request): Promise<Record<string, unknown>> {
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    throw new Error("EMPTY_BODY");
  }

  const parsed = JSON.parse(rawBody) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("INVALID_BODY");
  }

  return parsed as Record<string, unknown>;
}

export async function GET() {
  if (!canChangeKeys) {
    return NextResponse.json({
      error: "You are not allowed to access this resource",
      status: 403,
    });
  }
  const userConfigPath = getUserConfigPath();
  if (!userConfigPath) {
    return NextResponse.json({
      error: "User config path not found",
      status: 500,
    });
  }

  try {
    const parsedConfig =
      readUserConfigFile<Record<string, unknown>>(userConfigPath);
    return NextResponse.json(stripAuthFields(parsedConfig));
  } catch {
    return NextResponse.json(
      { error: "Unable to read user config", status: 500 },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!canChangeKeys) {
    return NextResponse.json({
      error: "You are not allowed to access this resource",
    });
  }

  const userConfigPath = getUserConfigPath();
  if (!userConfigPath) {
    return NextResponse.json(
      { error: "User config path not found", status: 500 },
      { status: 500 }
    );
  }

  try {
    const userConfig = stripAuthFieldsFromIncoming(
      await readConfigBody(request)
    ) as LLMConfig;
    const definedIncomingEntries = Object.entries(userConfig).filter(
      ([, value]) => value !== undefined
    );
    const mergedConfig = updateUserConfigFile<LLMConfig>(
      userConfigPath,
      (existingConfig) => {
        const existingSafe = stripAuthFields(
          existingConfig as Record<string, unknown>
        ) as LLMConfig;
        return {
          ...existingSafe,
          ...Object.fromEntries(definedIncomingEntries),
          USE_CUSTOM_URL:
            userConfig.USE_CUSTOM_URL === undefined
              ? existingSafe.USE_CUSTOM_URL
              : userConfig.USE_CUSTOM_URL,
          OPEN_WEBUI_IMAGE_URL:
            userConfig.OPEN_WEBUI_IMAGE_URL || existingSafe.OPEN_WEBUI_IMAGE_URL,
          OPEN_WEBUI_IMAGE_API_KEY:
            userConfig.OPEN_WEBUI_IMAGE_API_KEY || existingSafe.OPEN_WEBUI_IMAGE_API_KEY,
          CODEX_MODEL: userConfig.CODEX_MODEL || existingSafe.CODEX_MODEL,
          DISABLE_IMAGE_GENERATION: Object.prototype.hasOwnProperty.call(
            userConfig,
            "DISABLE_IMAGE_GENERATION"
          )
            ? userConfig.DISABLE_IMAGE_GENERATION
            : existingSafe.DISABLE_IMAGE_GENERATION,
          DISABLE_ANONYMOUS_TRACKING: Object.prototype.hasOwnProperty.call(
            userConfig,
            "DISABLE_ANONYMOUS_TRACKING"
          )
            ? userConfig.DISABLE_ANONYMOUS_TRACKING
            : existingSafe.DISABLE_ANONYMOUS_TRACKING,
        };
      }
    );
    return NextResponse.json(
      stripAuthFields(mergedConfig as Record<string, unknown>)
    );
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error &&
        (error.message === "EMPTY_BODY" || error.message === "INVALID_BODY"))
    ) {
      return NextResponse.json(
        { error: "Invalid user config JSON body", status: 400 },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Unable to save user config", status: 500 },
      { status: 500 }
    );
  }
}
