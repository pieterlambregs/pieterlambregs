// Builds dist/code.js: the plugin source with the portfolio content and
// project images baked in. Run from portfolio/:  npm run figma:plugin
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const { projects, categories } = await import(path.join(root, "src/content/projects.ts"));

// Tokens mirror src/app/globals.css. Keep the two in step.
const tokens = {
  primitives: [
    ["neutral/near-black", "#08090B"], ["neutral/charcoal", "#111214"], ["neutral/warm-white", "#F4F3EF"],
    ["neutral/stone", "#E9E8E2"], ["neutral/grey", "#A4A4A4"], ["neutral/grey-dark", "#5F5F5F"],
    ["neutral/line-on-dark", "#F4F3EF", 0.14], ["neutral/line-on-light", "#08090B", 0.16],
    ["lavender/400", "#B98CFF"], ["lavender/700", "#6D3FD6"], ["ice/200", "#B8D9FF"], ["ice/700", "#2F6FB8"],
  ],
  roles: [
    ["bg", "neutral/near-black", "neutral/warm-white", ["FRAME_FILL", "SHAPE_FILL"], "Page ground"],
    ["surface", "neutral/charcoal", "neutral/stone", ["FRAME_FILL", "SHAPE_FILL"], "Media frames before load, placeholders"],
    ["fg", "neutral/warm-white", "neutral/near-black", ["TEXT_FILL", "FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"], "Text and filled buttons"],
    ["muted", "neutral/grey", "neutral/grey-dark", ["TEXT_FILL"], "Supporting text and labels"],
    ["line", "neutral/line-on-dark", "neutral/line-on-light", ["STROKE_COLOR", "FRAME_FILL", "SHAPE_FILL"], "Hairlines and borders"],
    ["accent", "lavender/400", "lavender/700", ["TEXT_FILL", "FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"], "Category index, status dot, contact disc, focus ring. Use sparingly"],
    ["ice", "ice/200", "ice/700", ["TEXT_FILL", "FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"], "Reserved secondary accent"],
  ],
  layout: [
    ["space/gutter", 40, ["GAP"], "var(--gutter)", "Page side padding. Site: clamp(1rem, 2.4vw, 2.5rem)"],
    ["space/grid-gap", 24, ["GAP"], "clamp(0.75rem, 1.6vw, 1.5rem)", "12-column grid gap"],
    ["space/section-y", 176, ["GAP"], "clamp(6rem, 12vw, 11rem)", "Top and bottom padding of a home section (section-y)"],
    ["space/row-y", 16, ["GAP"], "1rem", "Padding inside a hairline row"],
    ["space/stack", 12, ["GAP"], "0.75rem", "Gap between label, title and text in a card"],
    ["radius/none", 0, ["CORNER_RADIUS"], "0", "Everything except pills"],
    ["radius/full", 999, ["CORNER_RADIUS"], "9999px", "Pills and the contact disc only"],
  ],
  text: [
    ["Display/XL", "Geist", "SemiBold", 200, 88, -4.5, true, "Hero name and case-study titles."],
    ["Display/L", "Geist", "SemiBold", 140, 88, -4.5, true, "Contact and large section headlines."],
    ["Display/M", "Geist", "SemiBold", 104, 88, -4.5, true, "Section headlines: Selected work, What I do."],
    ["Display/S", "Geist", "SemiBold", 64, 88, -4.5, true, "Project card titles, expertise rows, process steps."],
    ["Lead", "Geist", "Medium", 36, 116, -2.5, false, "Statements and overview paragraphs."],
    ["Body", "Geist", "Regular", 17, 145, 0, false, "text-body. Paragraphs and list values."],
    ["Small", "Geist", "Regular", 15, 150, 0, false, "text-small. Intro copy, card summaries, side notes."],
    ["Label", "Geist Mono", "Regular", 11, 140, 4, true, "label. Metadata, nav, buttons, captions."],
  ],
};

const motion = [
  ["EASE_OUT", "cubic-bezier(0.16, 1, 0.3, 1). Arrivals: reveals, hovers, list items."],
  ["EASE_IN_OUT", "cubic-bezier(0.76, 0, 0.24, 1). Wipes: page transition, mobile menu, nav hide."],
  ["Headline reveal", "Lines rise out of a mask, 1.1 s, 90 ms between lines, once per page view."],
  ["Hover", "Photos zoom 1.03 in their frame (0.7 s); pills fill (0.3 s) and press to 0.97."],
  ["Page transition", "Curtain wipes up 0.7 s, lifts 0.8 s after the next page renders."],
  ["Hero", "Glass form morphs continuously; follows the pointer and scroll. Still under reduced motion."],
  ["Reduced motion", "Everything rests: no smooth scroll, parallax, loader, cursor or transitions."],
];

async function encode(src) {
  const file = path.join(root, "public", src);
  const buf = await sharp(file).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const meta = await sharp(buf).metadata();
  return { data: buf.toString("base64"), w: meta.width, h: meta.height };
}

const out = [];
for (const p of projects) {
  const seen = new Set();
  const list = [];
  const add = async (m, cover = false) => {
    const src = m.type === "image" ? m.src : m.type === "youtube" ? m.poster : null;
    if (!src || seen.has(src)) return;
    seen.add(src);
    list.push({ src, cover, ai: /AI-generated/i.test(m.alt), ...(await encode(src)) });
  };
  await add(p.cover, true);
  for (const block of [...p.exploration, ...p.execution]) {
    for (const m of Array.isArray(block.media) ? block.media : [block.media]) await add(m);
  }
  const cat = categories.find((c) => c.id === p.category);
  out.push({
    slug: p.slug, title: p.title, client: p.client, year: p.year, discipline: p.discipline,
    role: p.role, summary: p.summary, category: { index: cat.index, name: cat.name },
    video: p.cover.type === "youtube" ? `https://youtu.be/${p.cover.id}` : null,
    media: list,
  });
}

const data = { tokens, motion, categories: categories.map((c) => ({ index: c.index, name: c.name })), projects: out };
const src = await readFile(path.join(here, "src/plugin.js"), "utf8");
await mkdir(path.join(here, "dist"), { recursive: true });
await writeFile(path.join(here, "dist/code.js"), src.replace("/* __DATA__ */", `const DATA = ${JSON.stringify(data)};`));
const images = out.reduce((n, p) => n + p.media.length, 0);
console.log(`dist/code.js written: ${out.length} projects, ${images} images`);
