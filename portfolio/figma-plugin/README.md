# Figma design-system builder

Builds the portfolio's design system in a Figma file from the content in this
repository: `src/content/projects.ts`, the tokens in `src/app/globals.css`
(mirrored in `build.mjs`) and the images in `public/work/`.

It creates or refreshes:

- **Foundations page**: cover, colour swatches, type specimen, motion spec.
- **Variables**: `Primitives`, `Color` (`dark/…` and `light/…` groups) and
  `Layout`, with CSS code syntax. One mode per collection, because the Figma
  Starter plan allows only one.
- **Text styles**: Display XL/L/M/S, Lead, Body, Small, Label.
- **Components page**: Pill link (with a hover prototype using the site's
  easing), Category tag, Fact row, Media frame (4 ratios, AI badge toggle),
  Project card.
- **Projects page**: one frame per project with its facts and every image.

Running it again is safe: variables and styles are updated in place, and the
components and project frames are rebuilt.

## Run it

You need Figma desktop and the Geist and Geist Mono fonts (both are Google
Fonts, already available in Figma).

1. Download this repository (GitHub → Code → Download ZIP) and unzip it.
2. In Figma desktop, open the design-system file.
3. Menu → Plugins → Development → Import plugin from manifest…, then pick
   `portfolio/figma-plugin/manifest.json`.
4. Menu → Plugins → Development → Portfolio design system builder.

It takes a few seconds and closes with a summary message.

## After changing the site

When projects, images or tokens change, rebuild the bundle and run the plugin
again:

```bash
cd portfolio
npm run figma:plugin   # writes figma-plugin/dist/code.js
```

The code stays the source of truth. Try image swaps and layouts in Figma, then
export final images as WebP into `public/work/<slug>/` and update
`src/content/projects.ts`.
