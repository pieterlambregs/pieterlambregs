# Design system — Pieter Lambregs portfolio

Dark, editorial, type-led. Typography carries the identity; colour is mostly
neutral with one lavender accent used sparingly. Everything below lives in
code; this file says where and when to use it.

## Tokens

All defined in `src/app/globals.css`. Use the Tailwind names, never raw values.

### Colour

| Token | Dark (default) | Light | Use |
| --- | --- | --- | --- |
| `bg` | `#08090B` | `#F4F3EF` | Page ground |
| `surface` | `#111214` | `#E9E8E2` | Media frames before load, placeholders |
| `fg` | `#F4F3EF` | `#08090B` | Text, filled buttons |
| `muted` | `#A4A4A4` | `#5F5F5F` | Supporting text, labels |
| `line` | `fg` at 14% | `fg` at 16% | Hairlines and borders |
| `accent` | `#B98CFF` | `#6D3FD6` | Category index, status dot, contact disc, focus ring |
| `ice` | `#B8D9FF` | `#2F6FB8` | Reserved; currently unused |

`.tone-flip` on a section inverts the active theme for that section (the light
moments: Philosophy, Process, case-study credits). `data-theme="light"` on
`<html>` flips the whole page.

### Type

Geist Sans for everything, Geist Mono for labels.

| Name | Class | Size / leading | Use |
| --- | --- | --- | --- |
| Display | `display` + a `text-[clamp(...)]` size | 600, 0.88, −0.045em, uppercase | Headlines; size is set per use |
| Body | `text-body` | 17px / 1.45 | Paragraphs, list values |
| Small | `text-small` | 15px / 1.5 | Intro copy, card summaries, side notes |
| Label | `label` | Mono 11px, uppercase, +0.04em | Metadata, nav, buttons, captions |

Add `leading-[1.35]` to `text-body` or `text-small` for single-line values
(fact lists, list titles).

### Space and layout

| Name | Class | Value |
| --- | --- | --- |
| Gutter | `gutter` | `clamp(1rem, 2.4vw, 2.5rem)` left and right |
| Grid | `grid-12` | 12 columns, `clamp(0.75rem, 1.6vw, 1.5rem)` gap |
| Section | `section-y` | `clamp(6rem, 12vw, 11rem)` top and bottom |

### Motion

CSS: `--ease-out`, `--ease-in-out` (and `ease-out-expo` in Tailwind).
JS: `EASE_OUT`, `EASE_IN_OUT` from `src/lib/motion.ts`.

- `EASE_OUT` for anything arriving: reveals, hovers, list items.
- `EASE_IN_OUT` for wipes: page transition, mobile menu, nav hide.
- Every motion component checks `useReducedMotion()` and rests when it is set.

## Components

In `src/components/ui/` unless noted.

| Component | Use it for |
| --- | --- |
| `PillLink` | The one button style: outlined pill, fills on hover, presses, magnetic. Page-to-page links only. |
| `TransitionLink` | Any internal link. Plays the page transition and smooth-scrolls anchors. |
| `Magnetic` | Wrap a single link or button to make it lean toward the pointer. Use sparingly. |
| `CategoryTag` | A project's discipline as `02 Brand & identity`. |
| `FactList` | Label/value pairs on hairlines. `variant="stacked"` (label above) or `"rows"` (label beside); `size="small"` for tighter spots. Pass grid classes via `className`. |
| `RevealLines` | Headlines whose lines rise out of a mask once, when scrolled into view. |
| `ScrollWords` | A statement paragraph whose words brighten as you scroll. One per page at most. |
| `MediaView` | Project image, video or pending placeholder in a fixed-ratio frame, optional parallax. |
| `ProjectCard` | Project preview: media, category, year, title, discipline, summary. |
| `LocalTime` | Pieter's local time in Belgium. |
| `case/Gallery` | Case-study media blocks: `full`, `inset`, `pair`, `trio`. |

## Rules

- One accent. Lavender marks an index, a status or the one call to action; it
  never fills a section or tints a photo.
- Hairlines, not boxes. Structure comes from `border-line` rules and the grid;
  no cards with shadows, no rounded panels. Rounded corners only on pills and
  the contact disc.
- Labels are for metadata. Headings stay display type; don't put a label above
  every heading.
- AI-generated images are always labelled as such, on the image and in its
  credits.
