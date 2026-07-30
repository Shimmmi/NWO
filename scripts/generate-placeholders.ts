import { readdir, readFile, mkdir, stat } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getAllCharacters, getNeutralCards } from "../lib/data";
import type { AbilityCard } from "../lib/game/types";

const ROOT = path.join(process.cwd(), "public", "placeholders");
const CARD_WIDTH = 360;
const CARD_HEIGHT = 540;
const WEBP_QUALITY = 85;
const CUSTOM_ART_MIN_BYTES = 10 * 1024;

const skipExisting = process.argv.includes("--skip-existing");

const RARITY_COLORS: Record<
  AbilityCard["rarity"],
  { from: string; to: string; border: string; label: string }
> = {
  common: { from: "#27272a", to: "#3f3f46", border: "#71717a", label: "COMMON" },
  rare: { from: "#1e3a5f", to: "#1d4ed8", border: "#3b82f6", label: "RARE" },
  epic: { from: "#4c1d95", to: "#7c3aed", border: "#a855f7", label: "EPIC" },
  legendary: { from: "#713f12", to: "#eab308", border: "#facc15", label: "LEGENDARY" },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function buildCardSvg(card: AbilityCard): string {
  const colors = RARITY_COLORS[card.rarity];
  const titleLines = wrapText(card.name, 16, 3);
  const titleTspans = titleLines
    .map((line, i) => {
      const dy = i === 0 ? "0" : "28";
      return `<tspan x="180" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.from}"/>
      <stop offset="100%" stop-color="${colors.to}"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <rect x="8" y="8" width="${CARD_WIDTH - 16}" height="${CARD_HEIGHT - 16}" rx="6" fill="none" stroke="${colors.border}" stroke-width="3"/>
  <rect x="24" y="24" width="${CARD_WIDTH - 48}" height="200" rx="4" fill="#18181b" opacity="0.45"/>
  <text x="180" y="280" text-anchor="middle" fill="#f4f4f5" font-family="sans-serif" font-size="22" font-weight="bold">
    ${titleTspans}
  </text>
  <text x="180" y="380" text-anchor="middle" fill="#d4d4d8" font-family="sans-serif" font-size="14">${colors.label}</text>
  <text x="180" y="420" text-anchor="middle" fill="#a1a1aa" font-family="sans-serif" font-size="12">⚡${card.cost} · SPD ${card.speed}</text>
  <text x="180" y="500" text-anchor="middle" fill="#71717a" font-family="monospace" font-size="11">${escapeXml(card.id)}</text>
</svg>`;
}

async function shouldSkipWebp(webpPath: string): Promise<boolean> {
  if (!skipExisting) return false;
  try {
    const info = await stat(webpPath);
    return info.size >= CUSTOM_ART_MIN_BYTES;
  } catch {
    return false;
  }
}

async function svgToWebp(svg: string | Buffer, outputPath: string): Promise<boolean> {
  if (await shouldSkipWebp(outputPath)) {
    console.log(`Skipped (existing): ${path.relative(ROOT, outputPath)}`);
    return false;
  }
  await sharp(svg).webp({ quality: WEBP_QUALITY }).toFile(outputPath);
  return true;
}

async function collectSvgFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSvgFiles(fullPath)));
    } else if (entry.name.endsWith(".svg")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function convertExistingSvgs(): Promise<number> {
  const svgFiles = await collectSvgFiles(ROOT);
  let count = 0;

  for (const svgPath of svgFiles) {
    const content = await readFile(svgPath);
    const webpPath = svgPath.replace(/\.svg$/, ".webp");
    if (await svgToWebp(content, webpPath)) {
      count++;
      console.log(`Converted: ${path.relative(ROOT, webpPath)}`);
    }
  }

  return count;
}

async function generateCardPlaceholders(): Promise<number> {
  const cardsDir = path.join(ROOT, "cards");
  await mkdir(cardsDir, { recursive: true });

  const seen = new Set<string>();
  let count = 0;

  for (const character of getAllCharacters()) {
    for (const card of character.abilityCards) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);

      const svg = buildCardSvg(card);
      const webpPath = path.join(cardsDir, `${card.id}.webp`);
      if (await svgToWebp(Buffer.from(svg), webpPath)) {
        count++;
      }
    }
  }

  for (const card of getNeutralCards()) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    const svg = buildCardSvg(card);
    const webpPath = path.join(cardsDir, `${card.id}.webp`);
    if (await svgToWebp(Buffer.from(svg), webpPath)) {
      count++;
    }
  }

  console.log(`Generated ${count} card placeholders`);
  return count;
}

async function main(): Promise<void> {
  console.log("Generating WebP placeholders...");
  if (skipExisting) {
    console.log(`Skip mode: files >= ${CUSTOM_ART_MIN_BYTES} bytes are preserved.\n`);
  } else {
    console.log("");
  }

  const converted = await convertExistingSvgs();
  const generated = await generateCardPlaceholders();

  console.log(`\nDone: ${converted} converted from SVG, ${generated} cards generated.`);
  console.log(`Total new/updated WebP files: ${converted + generated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
