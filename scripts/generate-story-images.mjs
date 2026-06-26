import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cwd, env } from "node:process";
import vm from "node:vm";
import ts from "typescript";

const DEFAULT_IDS = [
  "scene-01-title-prologue",
  "scene-04-abandoned-apartment-radio",
  "scene-07-rust-hospital-entry",
  "scene-11-flesh-tunnel-tracker",
  "scene-15-ash-church-ritual",
  "scene-20-sunken-school-entry",
  "scene-24-dawn-coast",
  "scene-31-emergency-room-night",
  "ending-redemption",
];

const args = parseArgs(process.argv.slice(2));
loadLocalEnv(".env.local");

const sharedConfig = {
  size: args.size || "1536x864",
  quality: args.quality || "medium",
  force: args.force,
  retries: args.retries,
};
const providers = getImageProviders();

if (providers.length === 0) {
  console.error("Missing IMAGE_GEN_API_KEY or FOG_IMAGE_REVIEW_API_KEY. Set it in .env.local.");
  process.exit(1);
}

const scenes = loadStoryScenes();
const ids = args.all ? scenes.map((scene) => scene.id) : args.ids.length ? args.ids : DEFAULT_IDS;
const selectedScenes = ids.map((id) => {
  const scene = scenes.find((entry) => entry.id === id);
  if (!scene) throw new Error(`Unknown story scene id: ${id}`);
  return scene;
});

const outDir = join(cwd(), "public", "assets", "story");
mkdirSync(outDir, { recursive: true });

console.log(`Generating ${selectedScenes.length} story image(s) with ${providers.map((provider) => provider.model).join(" -> ")}.`);
console.log(`Output: ${outDir}`);

const failures = [];
for (const scene of selectedScenes) {
  const outPath = join(outDir, `${scene.assetSlug}.png`);
  if (existsSync(outPath) && !sharedConfig.force) {
    console.log(`Skip existing ${basename(outPath)}. Use --force to replace.`);
    continue;
  }

  console.log(`Generate ${scene.order} ${scene.title} -> ${basename(outPath)}`);
  try {
    const imageBytes = await generateImageWithProviderFallback(scene.artPrompt, providers, sharedConfig);
    writeFileSync(outPath, imageBytes);
    console.log(`Wrote ${outPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${scene.id}: ${message}`);
    console.error(`Failed ${scene.id}: ${message}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} image job(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {
    all: false,
    force: false,
    ids: [],
    quality: "",
    retries: 2,
    size: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") {
      parsed.all = true;
    } else if (arg === "--force") {
      parsed.force = true;
    } else if (arg === "--ids") {
      parsed.ids = splitIds(argv[++index] || "");
    } else if (arg === "--quality") {
      parsed.quality = argv[++index] || "";
    } else if (arg === "--retries") {
      parsed.retries = Number(argv[++index] || "2");
    } else if (arg === "--size") {
      parsed.size = argv[++index] || "";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function splitIds(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function getImageProviders() {
  const primary = makeProvider("primary", {
    apiKey: readEnv("IMAGE_GEN_API_KEY") || readEnv("FOG_IMAGE_REVIEW_API_KEY"),
    baseUrl: readEnv("IMAGE_GEN_BASE_URL") || readEnv("FOG_IMAGE_REVIEW_BASE_URL") || "https://jiuuij.de5.net",
    model: readEnv("IMAGE_GEN_MODEL") || readEnv("FOG_IMAGE_REVIEW_MODEL") || "gpt-image-2",
  });
  const fallback = makeProvider("fallback", {
    apiKey: readEnv("IMAGE_GEN_FALLBACK_API_KEY") || readEnv("FOG_IMAGE_REVIEW_FALLBACK_API_KEY"),
    baseUrl: readEnv("IMAGE_GEN_FALLBACK_BASE_URL") || readEnv("FOG_IMAGE_REVIEW_FALLBACK_BASE_URL"),
    model: readEnv("IMAGE_GEN_FALLBACK_MODEL") || readEnv("FOG_IMAGE_REVIEW_FALLBACK_MODEL") || "gpt-image-2",
  });

  return [primary, fallback].filter(Boolean);
}

function makeProvider(label, provider) {
  if (!provider.apiKey) return null;
  return {
    label,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl || "https://jiuuij.de5.net",
    model: provider.model || "gpt-image-2",
  };
}

function unquote(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function loadStoryScenes() {
  const sourcePath = join(cwd(), "game", "storyScenes.ts");
  const source = readFileSync(sourcePath, "utf8");
  const outputText = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} } };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(outputText, sandbox, { filename: sourcePath });
  return sandbox.module.exports.STORY_SCENES;
}

async function generateImage(prompt, config) {
  const response = await fetch(imageEndpoint(config.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      n: 1,
      size: config.size,
      quality: config.quality,
      output_format: "png",
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Image API ${response.status}: ${bodyText}`);
  }

  const body = JSON.parse(bodyText);
  const item = body.data?.[0];
  if (item?.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item?.url) {
    const imageResponse = await fetch(item.url);
    if (!imageResponse.ok) {
      throw new Error(`Image download ${imageResponse.status}: ${await imageResponse.text()}`);
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error("Image API response did not include b64_json or url.");
}

async function generateImageWithProviderFallback(prompt, providers, sharedConfig) {
  let lastError;
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const config = { ...sharedConfig, ...provider };

    try {
      console.log(`Using ${provider.label} image provider: ${provider.baseUrl} / ${provider.model}`);
      return await generateImageWithRetries(prompt, config);
    } catch (error) {
      lastError = error;
      if (index >= providers.length - 1 || !shouldTryFallbackProvider(error)) break;

      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${provider.label} image provider failed, switching to fallback: ${message}`);
    }
  }

  throw lastError;
}

async function generateImageWithRetries(prompt, config) {
  let lastError;
  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      return await generateImage(prompt, config);
    } catch (error) {
      lastError = error;
      if (attempt >= config.retries || !isRetryable(error)) break;
      const delayMs = Math.min(60_000, 2_000 * 2 ** attempt);
      console.warn(`Retry ${attempt + 1}/${config.retries} in ${Math.round(delayMs / 1000)}s.`);
      await delay(delayMs);
    }
  }
  throw lastError;
}

function isRetryable(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(408|409|425|429|500|502|503|504)\b/.test(message) || /timeout|temporarily|rate/i.test(message);
}

function shouldTryFallbackProvider(error) {
  const message = error instanceof Error ? error.message : String(error);
  return isRetryable(error) || /\b(401|403)\b/.test(message) || /auth|invalid api key|unauthorized|forbidden/i.test(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function imageEndpoint(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/v1") ? `${normalized}/images/generations` : `${normalized}/v1/images/generations`;
}
