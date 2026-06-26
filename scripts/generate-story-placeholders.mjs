import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cwd } from "node:process";
import vm from "node:vm";
import sharp from "sharp";
import ts from "typescript";

const WIDTH = 1536;
const HEIGHT = 864;
const OUT_DIR = join(cwd(), "public", "assets", "story");

const args = parseArgs(process.argv.slice(2));
const scenes = loadStoryScenes();
const selected = args.all ? scenes : scenes.filter((scene) => args.ids.length === 0 || args.ids.includes(scene.id));

mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
let skipped = 0;
for (const scene of selected) {
  const outPath = join(OUT_DIR, `${scene.assetSlug}.png`);
  if (existsSync(outPath) && !args.force) {
    skipped += 1;
    continue;
  }

  const basePath = resolvePublicAsset(scene.image);
  const png = await renderScene(scene, basePath);
  await sharp(Buffer.from(png)).png({ compressionLevel: 9 }).toFile(outPath);
  written += 1;
  console.log(`Wrote ${basename(outPath)}`);
}

console.log(`Story placeholder pass complete. written=${written} skipped=${skipped}`);

function parseArgs(argv) {
  const parsed = {
    all: false,
    force: false,
    ids: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") parsed.all = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--ids") parsed.ids = splitIds(argv[++index] || "");
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function splitIds(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function resolvePublicAsset(src) {
  if (!src?.startsWith("/")) return "";
  const assetPath = join(cwd(), "public", src.replace(/^\/+/, ""));
  return existsSync(assetPath) ? assetPath : "";
}

async function renderScene(scene, basePath) {
  const mood = classifyScene(scene);
  const palette = paletteFor(mood);
  const seed = hash(scene.id);
  const panelA = scene.panels[0]?.imageDirection || scene.description || scene.title;
  const panelB = scene.panels[1]?.imageDirection || scene.description || scene.subtitle;

  const base = basePath
    ? await sharp(basePath).resize(WIDTH, HEIGHT, { fit: "cover" }).blur(2.2).modulate({ brightness: 0.62, saturation: 0.62 }).png().toBuffer()
    : await sharp({
        create: {
          width: WIDTH,
          height: HEIGHT,
          channels: 4,
          background: palette.bg,
        },
      })
        .png()
        .toBuffer();

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="grade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.shadow}" stop-opacity="0.74"/>
      <stop offset="0.48" stop-color="${palette.mid}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${palette.bg}" stop-opacity="0.84"/>
    </linearGradient>
    <radialGradient id="flash" cx="${34 + (seed % 28)}%" cy="${42 + (seed % 16)}%" r="46%">
      <stop offset="0" stop-color="${palette.light}" stop-opacity="0.58"/>
      <stop offset="0.26" stop-color="${palette.light}" stop-opacity="0.24"/>
      <stop offset="0.72" stop-color="${palette.mid}" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="${seed % 997}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.12"/>
      </feComponentTransfer>
    </filter>
  </defs>

  <rect width="1536" height="864" fill="url(#grade)"/>
  <rect width="1536" height="864" fill="url(#flash)"/>
  ${renderEnvironment(scene, mood, palette, seed)}
  ${renderSubject(scene, mood, palette, seed)}
  ${renderFog(seed, palette)}
  ${renderComicPanels(panelA, panelB, palette)}
  <rect width="1536" height="864" fill="black" opacity="0.18"/>
  <rect width="1536" height="864" filter="url(#grain)" opacity="0.55"/>
  <rect x="18" y="18" width="1500" height="828" fill="none" stroke="${palette.light}" stroke-opacity="0.24" stroke-width="2"/>
</svg>`;

  return sharp(base)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png()
    .toBuffer();
}

function classifyScene(scene) {
  const text = `${scene.id} ${scene.image} ${scene.assetSlug} ${scene.title} ${scene.location} ${scene.artPrompt}`.toLowerCase();
  if (text.includes("hospital") || text.includes("emergency") || text.includes("listener")) return "hospital";
  if (text.includes("church") || text.includes("ash") || text.includes("urn") || text.includes("name")) return "ash";
  if (text.includes("school") || text.includes("xiaoyu")) return "school";
  if (text.includes("coast") || text.includes("beach") || text.includes("dawn")) return "dawn";
  if (text.includes("flesh") || text.includes("tunnel") || text.includes("stalker")) return "flesh";
  if (text.includes("ending-denial") || text.includes("endless") || text.includes("wanderer")) return "fog";
  if (text.includes("apartment") || text.includes("radio")) return "apartment";
  return "street";
}

function paletteFor(mood) {
  const palettes = {
    apartment: { bg: "#11100f", shadow: "#050505", mid: "#425044", light: "#b0d28e", accent: "#d4b96f" },
    ash: { bg: "#15130f", shadow: "#060505", mid: "#514733", light: "#f3d37f", accent: "#d8c79d" },
    dawn: { bg: "#101514", shadow: "#060808", mid: "#5f6d64", light: "#ffe2a3", accent: "#9fc8c1" },
    flesh: { bg: "#140b0b", shadow: "#050202", mid: "#5d2e2a", light: "#d7856f", accent: "#7fb0c0" },
    fog: { bg: "#0b0d0d", shadow: "#030404", mid: "#3b4545", light: "#c7d3c5", accent: "#8caeaa" },
    hospital: { bg: "#120d0b", shadow: "#050403", mid: "#5d332a", light: "#f0a06d", accent: "#93bec4" },
    school: { bg: "#0b1215", shadow: "#030607", mid: "#344c55", light: "#bfd6db", accent: "#dedaa0" },
    street: { bg: "#0d1110", shadow: "#030404", mid: "#334942", light: "#d5bd79", accent: "#8bb7a3" },
  };
  return palettes[mood] || palettes.street;
}

function renderEnvironment(scene, mood, palette, seed) {
  const horizon = 420 + (seed % 70);
  const common = `
  <path d="M0 ${horizon} C220 ${horizon - 80}, 340 ${horizon + 52}, 540 ${horizon - 12} S920 ${horizon + 24}, 1536 ${horizon - 42} L1536 864 L0 864 Z" fill="${palette.shadow}" opacity="0.42"/>
  <path d="M0 690 C240 610, 400 640, 620 600 S1100 626, 1536 550 L1536 864 L0 864 Z" fill="${palette.mid}" opacity="0.18"/>
  `;

  if (mood === "hospital") {
    return `${common}
      ${rect(152, 182, 208, 518, -6, palette.shadow, 0.78)}
      ${rect(1112, 142, 228, 584, 5, palette.shadow, 0.75)}
      ${corridorLines(palette, seed)}
      <path d="M352 332 L1180 248 L1220 706 L300 736 Z" fill="${palette.bg}" opacity="0.34" stroke="${palette.light}" stroke-opacity="0.12"/>
      ${lightBars(palette, seed)}`;
  }

  if (mood === "ash") {
    return `${common}
      <path d="M284 720 L768 120 L1252 720 Z" fill="${palette.shadow}" opacity="0.42"/>
      <path d="M628 710 L768 302 L908 710 Z" fill="${palette.mid}" opacity="0.28"/>
      ${Array.from({ length: 18 }, (_, i) => urn(180 + ((i * 73 + seed) % 1150), 645 + (i % 3) * 28, palette)).join("")}
      ${windowRose(768, 252, palette)}`;
  }

  if (mood === "school") {
    return `${common}
      ${Array.from({ length: 8 }, (_, i) => desk(176 + i * 154, 610 + (i % 2) * 42, palette)).join("")}
      <rect x="252" y="190" width="1030" height="238" fill="${palette.shadow}" opacity="0.52" stroke="${palette.light}" stroke-opacity="0.14"/>
      <path d="M252 520 C520 470, 760 565, 1282 504 L1282 864 L252 864 Z" fill="${palette.light}" opacity="0.13"/>`;
  }

  if (mood === "dawn") {
    return `${common}
      <path d="M0 580 C250 520, 500 612, 768 560 S1238 502, 1536 540 L1536 864 L0 864 Z" fill="${palette.accent}" opacity="0.16"/>
      <circle cx="1128" cy="236" r="92" fill="${palette.light}" opacity="0.22" filter="url(#soft)"/>
      <path d="M120 690 C350 642, 612 732, 890 674 S1292 650, 1536 700 L1536 864 L0 864 Z" fill="${palette.shadow}" opacity="0.48"/>`;
  }

  if (mood === "flesh") {
    return `${common}
      ${Array.from({ length: 9 }, (_, i) => sinePipe(i, palette, seed)).join("")}
      <ellipse cx="768" cy="520" rx="560" ry="180" fill="${palette.mid}" opacity="0.22"/>
      <path d="M168 730 C430 600, 880 610, 1372 718" fill="none" stroke="${palette.accent}" stroke-opacity="0.28" stroke-width="7" stroke-dasharray="22 26"/>`;
  }

  if (mood === "apartment") {
    return `${common}
      ${corridorLines(palette, seed)}
      ${Array.from({ length: 9 }, (_, i) => rect(140 + i * 142, 180 + (i % 2) * 42, 70, 268, i % 2 ? 3 : -4, palette.shadow, 0.62)).join("")}
      ${Array.from({ length: 4 }, (_, i) => radio(380 + i * 246, 590 + (i % 2) * 34, palette)).join("")}`;
  }

  return `${common}
    ${Array.from({ length: 12 }, (_, i) => building(70 + i * 132, 220 + ((seed + i * 37) % 110), 88 + (i % 4) * 22, 440, i % 2 ? 5 : -4, palette)).join("")}
    <path d="M512 864 L732 470 L814 470 L1038 864 Z" fill="${palette.shadow}" opacity="0.38"/>
    ${Array.from({ length: 5 }, (_, i) => streetLamp(250 + i * 245, 310 + (i % 2) * 28, palette)).join("")}`;
}

function renderSubject(scene, mood, palette, seed) {
  const text = `${scene.id} ${scene.assetSlug} ${scene.artPrompt}`.toLowerCase();
  const protagonist = silhouette(780 + (seed % 110) - 55, 612, 1.18, palette, text.includes("ending") ? 0.78 : 0.94);
  const flashlight = `<path d="M802 586 L1334 ${420 + (seed % 160)} L1348 ${500 + (seed % 110)} L816 624 Z" fill="${palette.light}" opacity="0.18"/>
  <path d="M802 586 L1234 ${450 + (seed % 140)}" stroke="${palette.light}" stroke-width="5" stroke-opacity="0.32"/>`;

  if (text.includes("monster") || text.includes("wanderer") || text.includes("listener") || text.includes("stalker") || text.includes("brute")) {
    return `${flashlight}${protagonist}${monster(1048, 536, mood, palette, seed)}`;
  }
  if (text.includes("linchen") || text.includes("apparition") || text.includes("nurse")) {
    return `${flashlight}${protagonist}${ghost(1040, 500, palette)}`;
  }
  if (text.includes("survivor") || text.includes("old-wu") || text.includes("xiaoyu") || text.includes("companion")) {
    return `${flashlight}${protagonist}${silhouette(1028, 636, 0.78, palette, 0.62)}${silhouette(1134, 656, 0.55, palette, 0.54)}`;
  }
  if (text.includes("door") || text.includes("ending")) {
    return `${door(1032, 226, palette)}${protagonist}${ghost(606, 520, palette)}`;
  }
  if (text.includes("ash") || text.includes("urn")) {
    return `${flashlight}${protagonist}${urn(1012, 610, palette)}${urn(1070, 622, palette)}${urn(958, 630, palette)}`;
  }

  return `${flashlight}${protagonist}`;
}

function renderComicPanels(panelA, panelB, palette) {
  return `
  <g opacity="0.9">
    <path d="M70 72 H686 V294 H70 Z" fill="#050505" opacity="0.36" stroke="${palette.light}" stroke-opacity="0.22"/>
    <path d="M850 578 H1466 V790 H850 Z" fill="#050505" opacity="0.34" stroke="${palette.light}" stroke-opacity="0.20"/>
    ${panelGlyphs(105, 112, panelA, palette)}
    ${panelGlyphs(885, 618, panelB, palette)}
  </g>`;
}

function panelGlyphs(x, y, text, palette) {
  const words = String(text)
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, " ")
    .trim()
    .slice(0, 60);
  const count = Math.max(4, Math.min(11, Math.ceil(words.length / 6)));
  return Array.from({ length: count }, (_, i) => {
    const width = 210 + ((hash(words + i) % 260) || 40);
    return `<rect x="${x}" y="${y + i * 16}" width="${width}" height="4" rx="2" fill="${i % 3 === 0 ? palette.light : palette.accent}" opacity="${0.18 + (i % 4) * 0.045}"/>`;
  }).join("");
}

function renderFog(seed, palette) {
  return Array.from({ length: 28 }, (_, i) => {
    const x = -260 + ((seed * (i + 7) + i * 173) % 1980);
    const y = 110 + ((seed + i * 53) % 650);
    const rx = 160 + ((seed + i * 31) % 270);
    const ry = 28 + (i % 5) * 16;
    return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${i % 2 ? palette.light : palette.accent}" opacity="${0.035 + (i % 4) * 0.018}" filter="url(#soft)"/>`;
  }).join("");
}

function building(x, y, w, h, rotate, palette) {
  return rect(x, y, w, h, rotate, palette.shadow, 0.62);
}

function corridorLines(palette, seed) {
  const cx = 768 + (seed % 80) - 40;
  return `
    <path d="M0 846 L${cx} 388 L1536 846" fill="none" stroke="${palette.light}" stroke-opacity="0.10" stroke-width="3"/>
    <path d="M0 230 L${cx} 388 L1536 230" fill="none" stroke="${palette.light}" stroke-opacity="0.10" stroke-width="3"/>
    <path d="M${cx} 388 V864" stroke="${palette.light}" stroke-opacity="0.08" stroke-width="2"/>`;
}

function lightBars(palette, seed) {
  return Array.from({ length: 6 }, (_, i) => {
    const x = 360 + i * 150 + (seed % 25);
    return `<rect x="${x}" y="180" width="82" height="10" fill="${palette.light}" opacity="${0.16 + (i % 2) * 0.08}" filter="url(#soft)"/>`;
  }).join("");
}

function streetLamp(x, y, palette) {
  return `<g transform="translate(${x} ${y}) rotate(-8)">
    <rect x="-4" y="0" width="8" height="312" fill="${palette.shadow}" opacity="0.8"/>
    <path d="M0 0 C46 -22, 82 -16, 98 6" fill="none" stroke="${palette.shadow}" stroke-width="8" opacity="0.82"/>
    <circle cx="104" cy="12" r="18" fill="${palette.light}" opacity="0.46" filter="url(#soft)"/>
  </g>`;
}

function radio(x, y, palette) {
  return `<g transform="translate(${x} ${y})">
    <rect x="-42" y="-28" width="84" height="56" rx="8" fill="${palette.shadow}" opacity="0.86" stroke="${palette.light}" stroke-opacity="0.28"/>
    <circle cx="-18" cy="0" r="12" fill="${palette.light}" opacity="0.28"/>
    <rect x="8" y="-14" width="24" height="28" fill="${palette.accent}" opacity="0.22"/>
  </g>`;
}

function desk(x, y, palette) {
  return `<g transform="translate(${x} ${y}) rotate(-3)">
    <rect x="-56" y="-22" width="112" height="44" fill="${palette.shadow}" opacity="0.58" stroke="${palette.light}" stroke-opacity="0.12"/>
    <path d="M-42 22 L-52 66 M42 22 L52 66" stroke="${palette.shadow}" stroke-width="7" opacity="0.62"/>
  </g>`;
}

function urn(x, y, palette) {
  return `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="34" rx="34" ry="10" fill="${palette.shadow}" opacity="0.42"/>
    <path d="M-22 -18 C-34 22,-24 50,0 54 C24 50,34 22,22 -18 Z" fill="${palette.accent}" opacity="0.42" stroke="${palette.light}" stroke-opacity="0.22"/>
    <ellipse cx="0" cy="-18" rx="24" ry="10" fill="${palette.light}" opacity="0.22"/>
  </g>`;
}

function windowRose(x, y, palette) {
  return `<g transform="translate(${x} ${y})">
    <circle r="78" fill="${palette.light}" opacity="0.13"/>
    ${Array.from({ length: 12 }, (_, i) => `<path d="M0 0 L0 -76" transform="rotate(${i * 30})" stroke="${palette.light}" stroke-opacity="0.24" stroke-width="3"/>`).join("")}
    <circle r="76" fill="none" stroke="${palette.light}" stroke-opacity="0.28" stroke-width="4"/>
  </g>`;
}

function sinePipe(i, palette, seed) {
  const y = 220 + i * 62;
  const d = `M-80 ${y} C280 ${y - 90 + (seed % 60)}, 520 ${y + 96}, 820 ${y} S1240 ${y - 80}, 1640 ${y + 28}`;
  return `<path d="${d}" fill="none" stroke="${i % 2 ? palette.mid : palette.shadow}" stroke-width="${18 + (i % 3) * 8}" stroke-opacity="${0.20 + (i % 4) * 0.05}"/>`;
}

function silhouette(x, y, scale, palette, opacity) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
    <ellipse cx="0" cy="86" rx="42" ry="12" fill="#000" opacity="0.35"/>
    <path d="M-30 70 C-22 18,-20 -44,0 -62 C20 -44,22 18,30 70 Z" fill="${palette.shadow}"/>
    <circle cx="0" cy="-78" r="22" fill="${palette.shadow}"/>
    <path d="M-18 -34 L-56 28 M18 -34 L54 26" stroke="${palette.shadow}" stroke-width="11" stroke-linecap="round"/>
    <path d="M16 -28 L84 -48" stroke="${palette.light}" stroke-width="9" stroke-linecap="round" opacity="0.7"/>
  </g>`;
}

function ghost(x, y, palette) {
  return `<g transform="translate(${x} ${y})" opacity="0.62">
    <ellipse cx="0" cy="86" rx="60" ry="18" fill="${palette.light}" opacity="0.08"/>
    <path d="M-42 104 C-18 28,-42 -58,0 -104 C42 -58,18 28,42 104 C18 84,-12 122,-42 104 Z" fill="${palette.light}" opacity="0.22" stroke="${palette.light}" stroke-opacity="0.34"/>
    <circle cx="0" cy="-92" r="24" fill="${palette.light}" opacity="0.2"/>
  </g>`;
}

function monster(x, y, mood, palette, seed) {
  const wide = mood === "hospital" ? 1.2 : mood === "flesh" ? 0.7 : 0.9;
  const tall = mood === "hospital" ? 1.05 : mood === "flesh" ? 1.35 : 1.22;
  return `<g transform="translate(${x} ${y}) scale(${wide} ${tall})" opacity="0.76">
    <ellipse cx="0" cy="142" rx="76" ry="18" fill="#000" opacity="0.42"/>
    <path d="M-48 120 C-76 42,-46 -94,0 -126 C48 -88,76 42,48 120 C20 94,-18 154,-48 120 Z" fill="${palette.shadow}" stroke="${palette.light}" stroke-opacity="0.12"/>
    <path d="M-38 -44 C-96 -32,-126 26,-108 76 M38 -44 C94 -18,124 34,108 82" fill="none" stroke="${palette.shadow}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="-16" cy="-86" r="5" fill="${palette.accent}" opacity="${seed % 2 ? 0.72 : 0.2}"/>
    <circle cx="18" cy="-84" r="5" fill="${palette.accent}" opacity="0.62"/>
  </g>`;
}

function door(x, y, palette) {
  return `<g transform="translate(${x} ${y})">
    <rect x="-120" y="-8" width="240" height="420" fill="${palette.light}" opacity="0.16" filter="url(#soft)"/>
    <rect x="-88" y="0" width="176" height="408" fill="${palette.light}" opacity="0.32" stroke="${palette.light}" stroke-opacity="0.58"/>
    <rect x="-54" y="30" width="108" height="348" fill="#ffffff" opacity="0.18"/>
  </g>`;
}

function rect(x, y, w, h, rotate, fill, opacity) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" transform="rotate(${rotate} ${x + w / 2} ${y + h / 2})" fill="${fill}" opacity="${opacity}"/>`;
}

function hash(value) {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}
