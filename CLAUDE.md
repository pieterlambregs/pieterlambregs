# Pieter Lambregs portfolio (artlab-media.be)

Read this first in every session. Pieter writes in Dutch, often in short
one-line instructions: answer in Dutch, infer the obvious, and flag real
ambiguity instead of stalling. Code, comments and site copy stay in English.

## What this is

- `portfolio/`: the live portfolio of Pieter Lambregs (founder of ArtLab,
  designer at EG since Sept 2026). Next.js 16 static export, hosted on
  one.com (Apache shared hosting, no Node server) at https://artlab-media.be.
- Working branch: `claude/pieter-lambregs-portfolio-v8xvui`.
- `portfolio/DESIGN.md`: the design system (tokens, type, spacing, motion,
  components). It is the source of truth; keep it in sync with any change.
- `portfolio/figma-plugin/`: a Figma plugin that rebuilds the design system
  from the site's tokens (`npm run figma:plugin`). Rebuild it after token changes.
- `portfolio/AGENTS.md`: this Next.js version differs from training data.
  Read the guide in `portfolio/node_modules/next/dist/docs/` before changing
  framework-level code (config, routing, metadata, images).

## Quality bar

Pieter wants a "$10,000 website": award-level polish, smooth motion, nothing
that looks templated. Every change keeps that level. Before UI or motion work,
load these skills with the Skill tool:

| Skill | Use it for |
| --- | --- |
| `design-taste-frontend` (in `.agents/skills/`) | Overall direction, layout, the anti-template checks. Primary skill. |
| `emil-design-eng` | Animation decisions, easing, timing, micro-interactions. |
| `frontend-design` | Typography and visual choices on new sections. |
| `impeccable` | Final polish: hierarchy, responsive, edge cases. |
| `accessibility-review` | Contrast, focus, keyboard, reduced motion, before shipping. |
| `gsap-*` (in `.claude/skills/`, official GreenSock skills) | Any GSAP work: start with `gsap-react` and `gsap-scrolltrigger`; `gsap-core`, `gsap-timeline`, `gsap-plugins`, `gsap-utils`, `gsap-performance` as needed. |

## Colour palette (chosen by Pieter, Nov 2026, not yet applied)

Four colours, applied through the tokens in `src/app/globals.css`
(`--bg`, `--surface`, `--fg`, `--muted`, `--line`, `--accent`, `--ice`, dark
and light theme). The current tokens are near-black, off-white and a lavender
accent (see `portfolio/DESIGN.md`). When applying the palette, update
`globals.css`, the colour table in `DESIGN.md` and rebuild the Figma plugin.

| Name | Hex | Role |
| --- | --- | --- |
| Black | `#000000` | Dark theme background, text on lime and white |
| Violet | `#7D39EB` | Brand accent: buttons, highlights, light-theme accent |
| Lime | `#C6FF33` | Signal colour: dark-theme accent, status dot, focus, hover |
| White | `#FFFFFF` | Light theme background, text on black and violet |

Contrast rules (WCAG AA), checked:
- Lime on black is about 18:1 and fine for everything; lime on white fails.
  Never put lime text or thin lime lines on white.
- Violet on white (about 5.7:1) and white on violet pass for body text.
- Violet on black is only about 3.7:1: large text and UI shapes only,
  never body copy. In the dark theme use lime as the text accent.
- Use violet and lime as accents, not as large fills next to each other.
- Retune the glass hero's colours (`hero/GlassScene.tsx`) to the palette too.

## Stack and libraries (already installed, keep to these)

- **Motion** (`motion/react`): all UI animation, reveals, page transitions.
- **Lenis** (`lenis/react`): smooth scrolling, wired in `providers/Providers.tsx`.
- **React Three Fiber + drei + three**: the glass hero object (`hero/GlassScene.tsx`).
- **Tailwind CSS 4**, Geist / Geist Mono fonts.

- **GSAP** (free, all plugins included; add with `npm i gsap @gsap/react`
  when first needed): approved by Pieter for scroll storytelling.

Division of labour, so the two never animate the same element:
- Motion: component state, hovers, reveals, page transitions, layout.
- GSAP: pinned and scrubbed ScrollTrigger timelines, SplitText headline
  reveals, Flip and other sequences that Motion cannot do cleanly.
- Use `useGSAP()` from `@gsap/react` (scoped, auto cleanup). Drive
  ScrollTrigger from Lenis (`lenis.on("scroll", ScrollTrigger.update)` and
  the GSAP ticker) so smooth scroll and triggers stay in sync.
- Wrap GSAP effects in `gsap.matchMedia()` with a reduced-motion branch.

No other animation libraries (AOS, anime.js, etc.). Motion values over React
state for scroll-linked effects. Animate transform and opacity only. Every effect must
respect `prefers-reduced-motion` and work on touch devices.

## Where things live

- Content (copy, experience, projects): `src/content/site.ts`, `src/content/projects.ts`.
  `showPlaceholders: false` hides unwritten case sections.
- Media types: image, video, YouTube (click-to-play, local poster), pending.
- Files in `/public` referenced from components must go through `asset()`
  from `src/lib/asset.ts`, so the site also works from a subfolder.
- Logo: `components/ui/Logo.tsx` (ArtLab wordmark, from Logo_ArtLab.pdf).
  Icons: `src/app/icon.png`, `apple-icon.png`, `favicon.ico` (circle logo).

## Facts confirmed by Pieter (do not change without asking)

- 18 years of experience. Currently at EG (Designer, 2026 – Now).
- Sia Partners: Senior Marketing & UX/UI Consultant, 2024 – 2025.
- Autoglass Clinic: Marketing Lead, BeLux, 2025 – 2026.
- Hero, loader, footer and page titles stay "Pieter Lambregs"; only the nav
  shows the ArtLab logo.

## Build, check, deploy

```bash
cd portfolio
npm install
npm run lint && npm run build        # static site in out/ for the domain root
BASE_PATH=/nieuw npm run build       # only for a test copy in a subfolder
```

Check in a real browser before delivering: serve `out/` locally, screenshot
desktop (1440) and mobile (390), scroll each page, and confirm no 404s or
console errors (Playwright is available in the cloud workspace).

Deploy: Pieter uploads the contents of `out/` (zipped) to the web root on
one.com, including `.htaccess`. Name the zip unmistakably, e.g.
`UPLOAD-DEZE-artlab-media-be.zip`, and only ever send one deploy zip at a
time: in Nov 2026 a subfolder build ended up in the root and the site showed
unstyled. After he uploads, verify the live site with curl (the CSS link in
`index.html` must start with `/_next/`, not `/nieuw/`).

## Open items

- Case study text (background, strategy, concept) is still missing for most
  projects; Pieter will supply notes.
- Client logo permissions were never confirmed.
