// Portfolio design system builder.
// Generated data is injected by build.mjs as the DATA constant below.
// Safe to run more than once: it reuses variables, styles and components by
// name and rebuilds the project frames.

/* __DATA__ */

const FONTS = [
  { family: "Geist", style: "SemiBold" },
  { family: "Geist", style: "Medium" },
  { family: "Geist", style: "Regular" },
  { family: "Geist Mono", style: "Regular" },
];

const log = [];
const say = (m) => log.push(m);

function hex(h, a = 1) {
  const n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a };
}
const rgb = (h) => { const c = hex(h); return { r: c.r, g: c.g, b: c.b }; };

function b64ToBytes(b64) {
  return figma.base64Decode(b64);
}

/* ------------------------------------------------------------ variables */

async function collection(name, modeName) {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  let c = all.find((x) => x.name === name);
  if (!c) {
    c = figma.variables.createVariableCollection(name);
    c.renameMode(c.modes[0].modeId, modeName);
  }
  return c;
}

async function variable(coll, name, type) {
  const vars = await figma.variables.getLocalVariablesAsync(type);
  return vars.find((v) => v.name === name && v.variableCollectionId === coll.id) || figma.variables.createVariable(name, coll, type);
}

async function foundations() {
  const prim = await collection("Primitives", "Value");
  const pm = prim.modes[0].modeId;
  const P = {};
  for (const [name, h, a] of DATA.tokens.primitives) {
    const v = await variable(prim, name, "COLOR");
    v.setValueForMode(pm, hex(h, a));
    v.scopes = [];
    v.hiddenFromPublishing = true;
    P[name] = v;
  }

  const col = await collection("Color", "Value");
  const cm = col.modes[0].modeId;
  const C = {};
  for (const theme of ["dark", "light"]) {
    for (const [role, d, l, scopes, desc] of DATA.tokens.roles) {
      const v = await variable(col, `${theme}/${role}`, "COLOR");
      v.setValueForMode(cm, { type: "VARIABLE_ALIAS", id: P[theme === "dark" ? d : l].id });
      v.scopes = scopes;
      v.setVariableCodeSyntax("WEB", `var(--${role})`);
      v.description = `${desc}. ${theme === "dark" ? "Default theme." : "Light theme and .tone-flip sections."}`;
      C[`${theme}/${role}`] = v;
    }
  }

  const lay = await collection("Layout", "Desktop");
  const lm = lay.modes[0].modeId;
  const L = {};
  for (const [name, val, scopes, syntax, desc] of DATA.tokens.layout) {
    const v = await variable(lay, name, "FLOAT");
    v.setValueForMode(lm, val);
    v.scopes = scopes;
    v.setVariableCodeSyntax("WEB", syntax);
    v.description = desc;
    L[name] = v;
  }

  const existing = await figma.getLocalTextStylesAsync();
  const T = {};
  for (const [name, family, style, size, lh, ls, upper, desc] of DATA.tokens.text) {
    const t = existing.find((s) => s.name === name) || figma.createTextStyle();
    t.name = name;
    t.fontName = { family, style };
    t.fontSize = size;
    t.lineHeight = { unit: "PERCENT", value: lh };
    t.letterSpacing = { unit: "PERCENT", value: ls };
    t.textCase = upper ? "UPPER" : "ORIGINAL";
    t.description = desc;
    T[name] = t;
  }
  say("Foundations: variables and text styles ready");
  return { C, L, T };
}

/* ---------------------------------------------------------------- helpers */

function colorPaint(v) {
  return figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", v);
}

async function text(chars, style, colorVar, name) {
  const t = figma.createText();
  t.name = name || chars.slice(0, 24);
  await t.setTextStyleIdAsync(style.id);
  t.characters = chars;
  if (colorVar) t.fills = [colorPaint(colorVar)];
  return t;
}

async function wrapText(chars, style, colorVar, width, name) {
  const t = await text(chars, style, colorVar, name);
  t.resize(width, t.height);
  t.textAutoResize = "HEIGHT";
  return t;
}

function stackFrame(name, dir, gap = 0) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.primaryAxisSizingMode = "AUTO";
  f.counterAxisSizingMode = "AUTO";
  f.itemSpacing = gap;
  f.fills = [];
  return f;
}

// Fixed width, height hugs content. resize() resets sizing modes, so set them after.
function fixWidth(f, width) {
  f.resize(width, Math.max(f.height, 1));
  f.primaryAxisSizingMode = f.layoutMode === "VERTICAL" ? "AUTO" : "FIXED";
  f.counterAxisSizingMode = f.layoutMode === "VERTICAL" ? "FIXED" : "AUTO";
}

async function page(name) {
  let p = figma.root.children.find((x) => x.name === name);
  if (!p) {
    try {
      p = figma.createPage();
      p.name = name;
    } catch (e) {
      // Starter plan: three pages at most. Fall back to the last page.
      p = figma.root.children[figma.root.children.length - 1];
      say(`Could not add page "${name}" (${e.message}); using "${p.name}"`);
    }
  }
  return p;
}

function removeNamed(parent, name) {
  for (const n of parent.children.filter((c) => c.name === name)) n.remove();
}

/* ------------------------------------------------------------- components */

async function components(F) {
  const { C, L, T } = F;
  const p = await page("Components");
  await figma.setCurrentPageAsync(p);
  for (const n of ["Pill link", "Category tag", "Fact row", "Media frame", "Project card"]) removeNamed(p, n);

  // Pill link
  const pill = async (state) => {
    const c = figma.createComponent();
    c.name = `State=${state}`;
    c.layoutMode = "HORIZONTAL";
    c.primaryAxisSizingMode = "AUTO";
    c.counterAxisSizingMode = "FIXED";
    c.resize(240, 56);
    c.counterAxisAlignItems = "CENTER";
    c.paddingLeft = c.paddingRight = 32;
    for (const k of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) c.setBoundVariable(k, L["radius/full"]);
    c.strokes = [colorPaint(state === "Default" ? C["dark/line"] : C["dark/fg"])];
    c.strokeWeight = 1;
    c.fills = state === "Default" ? [] : [colorPaint(C["dark/fg"])];
    c.appendChild(await text("Browse all work by discipline", T["Label"], state === "Default" ? C["dark/fg"] : C["dark/bg"], "Label"));
    return c;
  };
  const pd = await pill("Default");
  const ph = await pill("Hover");
  const pillSet = figma.combineAsVariants([pd, ph], p);
  pillSet.name = "Pill link";
  pillSet.description = "The one button style. Outlined pill that fills on hover and presses on click. Page-to-page links only. Code: PillLink.";
  const pl = pillSet.addComponentProperty("Label", "TEXT", "Browse all work by discipline");
  for (const v of pillSet.children) v.findOne((n) => n.type === "TEXT").componentPropertyReferences = { characters: pl };
  layoutSet(pillSet);
  await pd.setReactionsAsync([
    {
      trigger: { type: "ON_HOVER" },
      actions: [
        {
          type: "NODE",
          destinationId: ph.id,
          navigation: "CHANGE_TO",
          transition: {
            type: "SMART_ANIMATE",
            easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 } },
            duration: 0.3,
          },
          preserveScrollPosition: false,
        },
      ],
    },
  ]);

  // Category tag
  const tag = figma.createComponent();
  tag.name = "Category tag";
  tag.layoutMode = "HORIZONTAL";
  tag.primaryAxisSizingMode = "AUTO";
  tag.counterAxisSizingMode = "AUTO";
  tag.itemSpacing = 7;
  tag.fills = [];
  const ti = await text("02", T["Label"], C["dark/accent"], "Index");
  const tn = await text("Brand & identity", T["Label"], C["dark/muted"], "Name");
  tag.appendChild(ti);
  tag.appendChild(tn);
  ti.componentPropertyReferences = { characters: tag.addComponentProperty("Index", "TEXT", "02") };
  tn.componentPropertyReferences = { characters: tag.addComponentProperty("Name", "TEXT", "Brand & identity") };
  tag.description = "A project discipline: accent index plus name. Code: CategoryTag. " + DATA.categories.map((c) => `${c.index} ${c.name}`).join(", ");

  // Fact row
  const fact = async (layout) => {
    const c = figma.createComponent();
    c.name = `Layout=${layout}`;
    const stacked = layout === "Stacked";
    c.layoutMode = stacked ? "VERTICAL" : "HORIZONTAL";
    c.resize(stacked ? 280 : 480, 60);
    c.primaryAxisSizingMode = stacked ? "AUTO" : "FIXED";
    c.counterAxisSizingMode = stacked ? "FIXED" : "AUTO";
    c.setBoundVariable("paddingTop", L["space/row-y"]);
    c.setBoundVariable("paddingBottom", L["space/row-y"]);
    c.itemSpacing = stacked ? 6 : 16;
    c.fills = [];
    c.strokes = [colorPaint(C["dark/line"])];
    c.strokeTopWeight = c.strokeLeftWeight = c.strokeRightWeight = 0;
    c.strokeBottomWeight = 1;
    const l = await text("Client", T["Label"], C["dark/muted"], "Label");
    const v = await text("Covas Immo", T["Body"], C["dark/fg"], "Value");
    c.appendChild(l);
    c.appendChild(v);
    if (!stacked) {
      l.textAutoResize = "HEIGHT";
      l.resize(112, l.height);
      l.layoutSizingHorizontal = "FIXED";
    }
    v.textAutoResize = "HEIGHT";
    v.layoutSizingHorizontal = "FILL";
    return c;
  };
  const factSet = figma.combineAsVariants([await fact("Stacked"), await fact("Rows")], p);
  factSet.name = "Fact row";
  factSet.description = "One label/value pair on a hairline. Stacked: label above value. Rows: label beside value. Code: FactList.";
  const fl = factSet.addComponentProperty("Label", "TEXT", "Client");
  const fv = factSet.addComponentProperty("Value", "TEXT", "Covas Immo");
  for (const v of factSet.children) {
    v.findOne((n) => n.name === "Label").componentPropertyReferences = { characters: fl };
    v.findOne((n) => n.name === "Value").componentPropertyReferences = { characters: fv };
  }
  layoutSet(factSet);

  // Media frame
  const media = [];
  for (const [r, w, h] of [["16:9", 640, 360], ["4:3", 480, 360], ["4:5", 288, 360], ["1:1", 360, 360]]) {
    const c = figma.createComponent();
    c.name = `Ratio=${r}`;
    c.resize(w, h);
    c.clipsContent = true;
    c.fills = [colorPaint(C["dark/surface"])];
    const img = figma.createRectangle();
    img.name = "Image";
    img.resize(w, h);
    img.fills = [colorPaint(C["dark/surface"])];
    c.appendChild(img);
    img.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
    const badge = stackFrame("AI badge", "HORIZONTAL");
    badge.paddingLeft = badge.paddingRight = 10;
    badge.paddingTop = badge.paddingBottom = 6;
    badge.fills = [{ type: "SOLID", color: rgb("#08090B") }];
    const bt = await text("AI-generated", T["Label"], null, "Badge label");
    bt.fills = [{ type: "SOLID", color: rgb("#F4F3EF") }];
    badge.appendChild(bt);
    c.appendChild(badge);
    badge.x = 12;
    badge.y = 12;
    media.push(c);
  }
  const mediaSet = figma.combineAsVariants(media, p);
  mediaSet.name = "Media frame";
  mediaSet.description =
    "Project image in a fixed-ratio frame. To change the picture: select the Image layer in an instance, open its fill and replace the image. Turn on AI badge for AI-generated images (always label them). Code: MediaView.";
  const ai = mediaSet.addComponentProperty("AI badge", "BOOLEAN", false);
  for (const v of mediaSet.children) v.findOne((n) => n.name === "AI badge").componentPropertyReferences = { visible: ai };
  layoutSet(mediaSet);

  // Project card
  const card = figma.createComponent();
  card.name = "Project card";
  card.layoutMode = "VERTICAL";
  card.resize(480, 100);
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED"; // after resize, on purpose
  card.setBoundVariable("itemSpacing", L["space/stack"]);
  card.fills = [];
  const cm = mediaSet.children.find((c) => c.name === "Ratio=4:3").createInstance();
  card.appendChild(cm);
  cm.layoutSizingHorizontal = "FILL";
  const meta = stackFrame("Meta", "HORIZONTAL", 16);
  meta.primaryAxisAlignItems = "SPACE_BETWEEN";
  meta.paddingTop = 12;
  meta.strokes = [colorPaint(C["dark/line"])];
  meta.strokeTopWeight = 1;
  meta.strokeBottomWeight = meta.strokeLeftWeight = meta.strokeRightWeight = 0;
  card.appendChild(meta);
  meta.layoutSizingHorizontal = "FILL";
  const ct = tag.createInstance();
  meta.appendChild(ct);
  const yr = await text("2022", T["Label"], C["dark/muted"], "Year");
  meta.appendChild(yr);
  const title = await text("Covas Immo", T["Display/S"], C["dark/fg"], "Title");
  card.appendChild(title);
  title.textAutoResize = "HEIGHT";
  title.layoutSizingHorizontal = "FILL";
  const disc = await text("Brand identity", T["Label"], C["dark/muted"], "Discipline");
  card.appendChild(disc);
  const sum = await text("A brand identity for a real-estate agency in Leuven.", T["Small"], C["dark/muted"], "Summary");
  card.appendChild(sum);
  sum.textAutoResize = "HEIGHT";
  sum.layoutSizingHorizontal = "FILL";
  title.componentPropertyReferences = { characters: card.addComponentProperty("Title", "TEXT", "Covas Immo") };
  yr.componentPropertyReferences = { characters: card.addComponentProperty("Year", "TEXT", "2022") };
  disc.componentPropertyReferences = { characters: card.addComponentProperty("Discipline", "TEXT", "Brand identity") };
  sum.componentPropertyReferences = { characters: card.addComponentProperty("Summary", "TEXT", "A brand identity for a real-estate agency in Leuven.") };
  card.description = "Project preview: media, category, year, title, discipline, summary. Swap the image on the nested Media frame. Code: ProjectCard.";

  let y = 0;
  for (const n of [pillSet, tag, factSet, mediaSet, card]) {
    n.x = 0;
    n.y = y;
    y += n.height + 120;
  }
  say("Components: Pill link, Category tag, Fact row, Media frame, Project card");
  return { tag, factSet, mediaSet, card };
}

function layoutSet(set) {
  set.layoutMode = "HORIZONTAL";
  set.primaryAxisSizingMode = "AUTO";
  set.counterAxisSizingMode = "AUTO";
  set.counterAxisAlignItems = "MIN";
  set.itemSpacing = 32;
  set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 32;
}

/* --------------------------------------------------------------- projects */

function closestRatio(w, h) {
  const r = w / h;
  const options = [["16:9", 16 / 9], ["4:3", 4 / 3], ["1:1", 1], ["4:5", 4 / 5]];
  return options.reduce((best, o) => (Math.abs(o[1] - r) < Math.abs(best[1] - r) ? o : best))[0];
}

async function projects(F, K) {
  const { C, T } = F;
  const p = await page("Projects");
  await figma.setCurrentPageAsync(p);
  for (const n of p.children.filter((c) => c.name.startsWith("Project / "))) n.remove();

  let x = 0;
  for (const proj of DATA.projects) {
    const f = stackFrame(`Project / ${proj.title}`, "VERTICAL", 32);
    f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = 48;
    fixWidth(f, 1200);
    f.fills = [colorPaint(C["dark/bg"])];
    p.appendChild(f);
    f.x = x;
    f.y = 0;
    x += 1320;

    const tag = K.tag.createInstance();
    tag.setProperties(propsFor(tag, { Index: proj.category.index, Name: proj.category.name }));
    f.appendChild(tag);

    const title = await wrapText(proj.title, T["Display/M"], C["dark/fg"], 1104, "Title");
    f.appendChild(title);

    const summary = await wrapText(proj.summary, T["Lead"], C["dark/fg"], 900, "Summary");
    f.appendChild(summary);

    const facts = stackFrame("Facts", "HORIZONTAL", 24);
    f.appendChild(facts);
    for (const [label, value] of [["Client", proj.client], ["Year", proj.year], ["Discipline", proj.discipline], ["Role", proj.role]]) {
      const row = K.factSet.children.find((c) => c.name === "Layout=Stacked").createInstance();
      row.setProperties(propsFor(row, { Label: label, Value: value }));
      facts.appendChild(row);
    }

    if (proj.video) {
      const v = await wrapText(`Video: ${proj.video}. Update the link in src/content/projects.ts.`, T["Label"], C["dark/accent"], 1104, "Video link");
      f.appendChild(v);
    }

    const grid = stackFrame("Media", "HORIZONTAL", 24);
    f.appendChild(grid);
    grid.layoutSizingHorizontal = "FILL";
    grid.layoutWrap = "WRAP";
    grid.counterAxisSpacing = 24;

    for (const m of proj.media) {
      const variant = K.mediaSet.children.find((c) => c.name === `Ratio=${closestRatio(m.w, m.h)}`);
      const inst = variant.createInstance();
      inst.name = m.src;
      if (m.ai) inst.setProperties(propsFor(inst, { "AI badge": true }));
      const img = figma.createImage(b64ToBytes(m.data));
      const rect = inst.findOne((n) => n.name === "Image");
      rect.fills = [{ type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" }];
      const scale = (m.cover ? 1104 : 540) / inst.width;
      inst.resize(Math.round(inst.width * scale), Math.round(inst.height * scale));
      grid.appendChild(inst);
    }

    const note = await wrapText(
      `Source: src/content/projects.ts → "${proj.slug}". Images: public/work/${proj.slug}/. Swap an image here to try it, then export it at 2000px wide as WebP into that folder.`,
      T["Label"],
      C["dark/muted"],
      1104,
      "Maintenance note",
    );
    f.appendChild(note);
  }
  say(`Projects: ${DATA.projects.length} project frames with their images`);
}

function propsFor(instance, wanted) {
  // Component property keys carry an id suffix ("Title#12:3"); match by name.
  const out = {};
  for (const key of Object.keys(instance.componentProperties)) {
    const name = key.split("#")[0];
    if (name in wanted) out[key] = wanted[name];
  }
  return out;
}

/* ------------------------------------------------------------ foundations */

async function foundationsPage(F) {
  const { C, T } = F;
  const p = await page("Foundations");
  await figma.setCurrentPageAsync(p);
  for (const n of p.children.filter((c) => ["Cover", "Colour", "Type", "Motion"].includes(c.name))) n.remove();

  // Cover
  const cover = stackFrame("Cover", "VERTICAL", 24);
  cover.paddingLeft = cover.paddingRight = cover.paddingTop = cover.paddingBottom = 64;
  fixWidth(cover, 1440);
  cover.fills = [colorPaint(C["dark/bg"])];
  p.appendChild(cover);
  cover.appendChild(await wrapText("Pieter Lambregs", T["Display/XL"], C["dark/fg"], 1312, "Title"));
  cover.appendChild(await wrapText("Portfolio design system. Built from the code in github.com/pieterlambregs/pieterlambregs (portfolio/). The code is the source of truth: change tokens in globals.css and content in src/content, then run this plugin again to refresh this file.", T["Lead"], C["dark/muted"], 1000, "Intro"));

  // Colour
  const colour = stackFrame("Colour", "VERTICAL", 24);
  colour.paddingLeft = colour.paddingRight = colour.paddingTop = colour.paddingBottom = 64;
  colour.fills = [colorPaint(C["dark/bg"])];
  p.appendChild(colour);
  colour.appendChild(await text("Colour", T["Display/S"], C["dark/fg"]));
  for (const theme of ["dark", "light"]) {
    const row = stackFrame(`${theme} theme`, "HORIZONTAL", 16);
    colour.appendChild(row);
    for (const [role] of DATA.tokens.roles) {
      const cell = stackFrame(role, "VERTICAL", 8);
      const sw = figma.createRectangle();
      sw.resize(140, 96);
      sw.fills = [colorPaint(C[`${theme}/${role}`])];
      sw.strokes = [colorPaint(C["dark/line"])];
      cell.appendChild(sw);
      cell.appendChild(await text(`${theme}/${role}`, T["Label"], C["dark/muted"]));
      row.appendChild(cell);
    }
  }

  // Type
  const type = stackFrame("Type", "VERTICAL", 32);
  type.paddingLeft = type.paddingRight = type.paddingTop = type.paddingBottom = 64;
  type.fills = [colorPaint(C["dark/bg"])];
  p.appendChild(type);
  type.appendChild(await text("Type", T["Display/S"], C["dark/fg"]));
  for (const [name, , , size, lh] of DATA.tokens.text) {
    const row = stackFrame(name, "VERTICAL", 8);
    row.appendChild(await text(`${name} · ${size}px / ${lh}%`, T["Label"], C["dark/muted"]));
    row.appendChild(await text(name.startsWith("Display") ? "Design is more" : "I turn ideas into meaningful visual experiences.", T[name], C["dark/fg"]));
    type.appendChild(row);
  }

  // Motion
  const motion = stackFrame("Motion", "VERTICAL", 20);
  motion.paddingLeft = motion.paddingRight = motion.paddingTop = motion.paddingBottom = 64;
  fixWidth(motion, 1000);
  motion.fills = [colorPaint(C["dark/bg"])];
  p.appendChild(motion);
  motion.appendChild(await text("Motion", T["Display/S"], C["dark/fg"]));
  for (const [name, spec] of DATA.motion) {
    const row = stackFrame(name, "HORIZONTAL", 24);
    row.paddingTop = row.paddingBottom = 12;
    row.strokes = [colorPaint(C["dark/line"])];
    row.strokeTopWeight = row.strokeLeftWeight = row.strokeRightWeight = 0;
    row.strokeBottomWeight = 1;
    motion.appendChild(row);
    row.layoutSizingHorizontal = "FILL";
    const l = await text(name, T["Label"], C["dark/muted"]);
    row.appendChild(l);
    l.resize(240, l.height);
    l.textAutoResize = "HEIGHT";
    const v = await text(spec, T["Body"], C["dark/fg"]);
    row.appendChild(v);
    v.textAutoResize = "HEIGHT";
    v.layoutSizingHorizontal = "FILL";
  }
  motion.appendChild(await wrapText("Prototype: the Pill link on the Components page uses Smart animate with the site's EASE_OUT curve. Press Present on that page to try it.", T["Small"], C["dark/muted"], 872));

  let y = 0;
  for (const n of [cover, colour, type, motion]) {
    n.x = 0;
    n.y = y;
    y += n.height + 120;
  }
  say("Foundations page: cover, colour, type and motion");
}

/* ------------------------------------------------------------------- run */

async function run() {
  for (const f of FONTS) {
    try {
      await figma.loadFontAsync(f);
    } catch (e) {
      throw new Error(`Font "${f.family} ${f.style}" is not available. Install Geist and Geist Mono (vercel.com/font) and run again.`);
    }
  }
  const F = await foundations();
  const K = await components(F);
  await projects(F, K);
  await foundationsPage(F);
  figma.closePlugin("Design system built. " + log.join(" · "));
}

run().catch((e) => figma.closePlugin("Stopped: " + e.message));
