# Pieter Lambregs — Portfolio 2026

Personal portfolio site. Next.js (App Router), React, TypeScript, Tailwind CSS 4,
Motion, Lenis and React Three Fiber.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export to out/ (upload this folder to one.com)
npm run lint
```

## Editing content

Nothing a visitor reads is hard-coded in a component.

| What | Where |
| --- | --- |
| Name, intro, status line, email, social links | `src/content/site.ts` |
| Philosophy, about, experience, expertise, process, contact copy | `src/content/site.ts` |
| Projects, categories, case study text and galleries | `src/content/projects.ts` |
| Project images and video | `public/work/<slug>/` |

### Adding a project

1. Put the media in `public/work/<slug>/` (WebP for images, MP4 for video).
2. Copy an entry in `src/content/projects.ts` and edit it. Give every image its
   real pixel `width` and `height` and a descriptive `alt`.
3. That is all. The home gallery, `/work`, the case study page, related
   projects, previous/next links and the sitemap are generated from that file.

Gallery blocks choose their own composition: `full`, `inset`, `pair` or `trio`.

### Placeholders

Case study sections without text (`story.background`, `story.strategy`,
`story.concept` left `undefined`) show a marked placeholder box. Media of type
`"pending"` shows a marked placeholder frame. To hide all unfinished sections
instead, set `showPlaceholders: false` in `src/content/site.ts`.

## Before launch

- Set `site.url` in `src/content/site.ts` to the production domain.
- Check every row of `about.experience` and the dates in `projects.ts`.
- Write the missing case study sections (placeholders are currently off, so
  unfinished sections are hidden).

## Structure

```
src/
  app/                 routes: /, /work, /work/[slug], sitemap, robots, 404
  content/             all copy and project data
  components/
    hero/              WebGL hero (glass form refracting the name)
    sections/          home page sections
    case/              case study gallery
    ui/                cursor, magnetic links, reveals, media, transitions
    providers/         smooth scroll, page transitions, theme
```

## Behaviour notes

- **Theme**: dark by default; the toggle in the navigation stores the choice.
- **Reduced motion**: smooth scrolling, the custom cursor, parallax, the loader
  and page transitions are switched off, and the 3D form renders as a still.
- **No WebGL**: the hero falls back to its HTML headline.
- **Loader**: plays once per browser session, in CSS only.
