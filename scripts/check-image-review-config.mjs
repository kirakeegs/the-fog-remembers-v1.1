import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd, env } from "node:process";

loadLocalEnv(".env.local");

const config = {
  provider: readEnv("FOG_IMAGE_REVIEW_PROVIDER") || "openai-compatible",
  baseUrl: normalizeBaseUrl(readEnv("FOG_IMAGE_REVIEW_BASE_URL") || readEnv("IMAGE_GEN_BASE_URL") || "https://jiuuij.de5.net"),
  model: readEnv("FOG_IMAGE_REVIEW_MODEL") || readEnv("IMAGE_GEN_MODEL") || "gpt-image-2",
  apiKey: readEnv("FOG_IMAGE_REVIEW_API_KEY") || readEnv("IMAGE_GEN_API_KEY"),
  fallbackBaseUrl: normalizeBaseUrl(readEnv("FOG_IMAGE_REVIEW_FALLBACK_BASE_URL") || readEnv("IMAGE_GEN_FALLBACK_BASE_URL")),
  fallbackModel: readEnv("FOG_IMAGE_REVIEW_FALLBACK_MODEL") || readEnv("IMAGE_GEN_FALLBACK_MODEL") || "gpt-image-2",
  fallbackApiKey: readEnv("FOG_IMAGE_REVIEW_FALLBACK_API_KEY") || readEnv("IMAGE_GEN_FALLBACK_API_KEY"),
};

if (!config.apiKey) {
  console.error("Missing FOG_IMAGE_REVIEW_API_KEY or IMAGE_GEN_API_KEY. Copy .env.example to .env.local and fill the local secret.");
  process.exit(1);
}

console.log("Image review provider configured:");
console.log(`provider=${config.provider}`);
console.log(`baseUrl=${config.baseUrl}`);
console.log(`model=${config.model}`);
console.log(`apiKey=${maskSecret(config.apiKey)}`);
if (config.fallbackApiKey || config.fallbackBaseUrl) {
  console.log("Fallback image provider configured:");
  console.log(`fallbackBaseUrl=${config.fallbackBaseUrl || "(not set)"}`);
  console.log(`fallbackModel=${config.fallbackModel}`);
  console.log(`fallbackApiKey=${maskSecret(config.fallbackApiKey)}`);
}

function loadLocalEnv(fileName) {
  const filePath = join(cwd(), fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const name = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (env[name]) continue;

    env[name] = unquote(rawValue);
  }
}

function readEnv(name) {
  return env[name]?.trim() || "";
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}
