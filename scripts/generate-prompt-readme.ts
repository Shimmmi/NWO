import { writeFile } from "fs/promises";
import path from "path";
import {
  MASTER_PREFIX,
  PORTRAIT_TECH,
  CARD_TECH,
  MASTER_NEGATIVE,
  FACTION_PHRASE,
  PORTRAITS,
  DONALD_CARDS,
  VLADIMIR_CARDS,
  JIN_CARDS,
  VLADO_CARDS,
  NEUTRAL_CARDS,
  SHARED_ASSETS,
  buildPrompt,
  type LockedAsset,
} from "../lib/game/locked-prompts";

const OUTPUT = path.join(process.cwd(), "public", "placeholders", "README.md");

function assetBlock(asset: LockedAsset): string {
  const lines = [
    `#### ${asset.id}`,
    `- **Файл:** \`${asset.file}\``,
    `- **Размер:** ${asset.width}×${asset.height}${asset.alpha ? " RGBA cutout" : ""}`,
  ];
  if (asset.rarity) lines.push(`- **Редкость (optics):** ${asset.rarity}`);
  lines.push(`- **Промпт (EN):**`);
  lines.push(`  ${buildPrompt(asset)}`);
  lines.push(`- **Negative prompt:** \`${MASTER_NEGATIVE}\``);
  lines.push("");
  return lines.join("\n");
}

function factionCards(title: string, assets: LockedAsset[]): string {
  return [`### ${title}\n`, ...assets.map(assetBlock)].join("\n");
}

async function main(): Promise<void> {
  const content = [
    "# Placeholders — промпты для генерации артов",
    "",
    "Справочник **LOCKED** промптов WORLD ORDER (Style Bible v1.0).",
    "Источник: `lib/game/locked-prompts.ts` · полный каталог: `PROMPTS.LOCKED.md`",
    "Регенерация: `npm run placeholders:prompts`",
    "",
    "## Общий стиль (Style Bible)",
    "",
    "Игра **WORLD ORDER** — политическая сатирическая TCG. Арты: editorial cartoon caricature, не фотореализм.",
    "",
    "**Master prefix (первая фраза каждого промпта, verbatim):**",
    "```",
    MASTER_PREFIX,
    "```",
    "",
    "**Portrait tech (Three.js billboard):**",
    "```",
    PORTRAIT_TECH,
    "```",
    "",
    "**Card tech (art panel only — chrome в UI):**",
    "```",
    CARD_TECH,
    "```",
    "",
    "**Negative prompt (для всех ассетов):**",
    "```",
    MASTER_NEGATIVE,
    "```",
    "",
    "| characterId | Accent phrase |",
    "|---|---|",
    ...Object.entries(FACTION_PHRASE).map(
      ([id, phrase]) => `| ${id} | ${phrase} |`,
    ),
    "",
    "---",
    "",
    "## Технические требования",
    "",
    "| Тип | Размер | Файл | Формат |",
    "|---|---|---|---|",
    "| Портреты (Three.js) | **512×768** px (2:3) RGBA | `characters/{id}-form{N}.webp` | WebP + alpha |",
    "| Карты способностей | 360×540 px (2:3) opaque | `cards/{id}.webp` | WebP q85 |",
    "| Арена | 1920×1080 px | `arena/default.webp` | WebP landscape |",
    "| Рубашка / fallback | 360×540 px | `cards/card-back.webp`, `cards/fallback-*.webp` | WebP |",
    "",
    "**Регенерация заглушек:** `npm run placeholders:generate`  ",
    "**LOCKED art (style bible scenes):** `npm run placeholders:art`  ",
    "**LOCKED prompts markdown:** `npm run placeholders:locked`  ",
    "**Регенерация этого README:** `npm run placeholders:prompts`",
    "",
    "> После подстановки финальных артов используйте `npm run placeholders:generate -- --skip-existing`, чтобы не затереть файлы ≥ 10 KB.",
    "",
    "---",
    "",
    "## Портреты персонажей (12)",
    "",
    ...PORTRAITS.map(assetBlock),
    "> Всего карт: 104 (80 фракция + 24 нейтрала)",
    "",
    "## Карты по колодам (104)",
    "",
    factionCards("Дональд Рампф — США", DONALD_CARDS),
    factionCards("Владимир Пу — Россия", VLADIMIR_CARDS),
    factionCards("Джин Ши — Китай", JIN_CARDS),
    factionCards("Владо Зеленко — Украина", VLADO_CARDS),
    factionCards("Нейтралы — Глобальные решения", NEUTRAL_CARDS),
    "## Общие ассеты",
    "",
    ...SHARED_ASSETS.map(assetBlock),
    "## Итого",
    "",
    "| Категория | Количество |",
    "|---|---|",
    "| Портреты | 12 |",
    "| Карты фракций | 80 |",
    "| Нейтралы | 24 |",
    "| Арена | 1 |",
    "| Рубашка | 1 |",
    "| Fallback | 4 |",
    "| **Всего** | **122** |",
    "",
    "Полные промпты + arena layers: [`PROMPTS.LOCKED.md`](./PROMPTS.LOCKED.md)",
    "",
  ].join("\n");

  await writeFile(OUTPUT, content, "utf-8");
  const promptCount = (content.match(/\*\*Промпт \(EN\):\*\*/g) ?? []).length;
  console.log(`Written: ${OUTPUT}`);
  console.log(`Prompt sections: ${promptCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
