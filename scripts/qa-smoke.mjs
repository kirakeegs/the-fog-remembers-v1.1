import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.QA_PORT || 3137);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const START_TIMEOUT_MS = 45_000;
const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const NEXT_CLI = join(ROOT_DIR, "node_modules", "next", "dist", "bin", "next");
const CHECKS = [
  { path: "/", includes: ["THE FOG REMEMBERS", "雾会记得"] },
  { path: "/assets/generated/fog-remembers-cover-street-v3.png", binary: true },
  { path: "/assets/scenes/scene-tidal-street.png", binary: true },
  { path: "/assets/scenes/scene-abandoned-apartment.png", binary: true },
  { path: "/assets/scenes/scene-rust-hospital.png", binary: true },
  { path: "/assets/scenes/scene-flesh-tunnel.png", binary: true },
  { path: "/assets/scenes/scene-ash-church.png", binary: true },
  { path: "/assets/scenes/scene-sunken-school.png", binary: true },
  { path: "/assets/scenes/scene-dawn-coast.png", binary: true },
  { path: "/assets/scenes/scene-dawn-ward.png", binary: true },
  { path: "/assets/scenes/scene-endless-descent.png", binary: true },
  { path: "/assets/monsters/monster-wanderer.png", binary: true },
  { path: "/assets/monsters/monster-stalker.png", binary: true },
  { path: "/assets/monsters/monster-listener.png", binary: true },
  { path: "/assets/monsters/monster-brute.png", binary: true },
  { path: "/assets/monsters/monster-crawler.png", binary: true },
  { path: "/assets/characters/character-survivor-player.png", binary: true },
  { path: "/assets/characters/character-rescued-survivor.png", binary: true },
  { path: "/assets/characters/hallucination-shadow.png", binary: true },
  { path: "/assets/items/item-battery.png", binary: true },
  { path: "/assets/items/item-potion.png", binary: true },
  { path: "/assets/items/item-crucifix-relic.png", binary: true },
  { path: "/assets/items/item-clue-note.png", binary: true },
  { path: "/assets/ui/recall-sigil.png", binary: true },
  { path: "/audio/silent.mp3", binary: true },
];

const child = spawn(process.execPath, [NEXT_CLI, "dev", "-p", String(PORT)], {
  cwd: ROOT_DIR,
  env: { ...process.env, PORT: String(PORT), NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

const shutdown = () => {
  if (!child.killed) child.kill("SIGTERM");
};

process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

try {
  await waitForServer();
  for (const check of CHECKS) {
    await runCheck(check);
  }
  console.log(`QA smoke passed at ${BASE_URL}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (output.trim()) {
    console.error("\nNext output:");
    console.error(output.trim().slice(-4000));
  }
  process.exitCode = 1;
} finally {
  shutdown();
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < START_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(BASE_URL, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Retry until the dev server finishes compiling.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

async function runCheck(check) {
  const url = `${BASE_URL}${check.path}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Expected ${url} to return 2xx, got ${response.status}`);
  }

  if (check.binary) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 100) {
      throw new Error(`Expected ${url} to return a non-empty asset`);
    }
    console.log(`ok ${check.path} (${bytes.byteLength} bytes)`);
    return;
  }

  const text = await response.text();
  for (const expected of check.includes || []) {
    if (!text.includes(expected)) {
      throw new Error(`Expected ${url} to include "${expected}"`);
    }
  }
  console.log(`ok ${check.path}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
