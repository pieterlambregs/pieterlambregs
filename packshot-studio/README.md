# Packshot Studio

Upload a print-ready folding-carton file and get a photorealistic packshot of the **original
artwork** on an accurate 3D box: PNG, JPG or PDF. No generative image AI anywhere: the artwork
is rasterised from the print file, converted CMYK → sRGB through an ICC profile, and rendered
in Blender Cycles.

```
Upload  →  Review panels  →  Set up scene  →  Render  →  Download
```

## Start

```bash
cp .env.example .env            # settings: local only (default) or shared with logins
docker compose up -d --build
# open http://localhost:8080
```

Dutch step-by-step guide for running it on your own computer and sharing it with colleagues
on the same network (with logins): [HANDLEIDING.md](HANDLEIDING.md). By default the app is only
reachable on the computer itself; sharing (`PACKSHOT_BIND=0.0.0.0`) refuses to start without
logins (`PACKSHOT_USERS`).

Services: `web` (React UI on nginx, port 8080), `api` (FastAPI), `worker` (RQ + Blender
Cycles, renders on CPU), `redis` (job queue). Projects and renders live in the
`packshot-data` volume. More render throughput: `docker compose up --scale worker=2`.

### Without Docker (development)

Needs Python **3.13** (the `bpy` wheel is built for it) and Node 22.

```bash
cd backend
pip install -r requirements.txt bpy==5.3.0
python -m uvicorn app.main:app --port 8000      # no REDIS_URL: renders run in a local thread

cd ../frontend
npm install
npm run dev                                      # http://localhost:5173 (proxies /api)
```

`backend/samples/make_sample.py` generates a synthetic carton that exists **only for the
automated tests**. It is not artwork and must never be used for visuals: packshots are made
exclusively from real print files.

### Tests

```bash
cd backend && python -m pytest -q
```

Covers file-name parsing, dieline detection (spot colour, layer, flattened colour detection,
rotated sheets, flap orientation, scale check), removal of dieline marks without touching
artwork, residue detection (and no false alarm on a magenta logo), and the verification step
(identical artwork passes; one missing letter, moved artwork, stray background pixels fail).

## How it works

### 1. File analysis (`backend/app/pdf_inspect.py`, `dieline.py`, `filename_parser.py`)

* **File name** → editable fields: date code, brand, product, dimensions, pack size, version;
  unknown tokens become tags. `01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3.pdf` →
  `01-26`, `EG`, `Ferropti FORTE`, `1085x695x695mm`, `90comp`, version `3`, tag `DD`.
* **Dimensions are never trusted from the name.** Both readings (mm and tenths of a mm) are
  compared with the panels measured on the dieline. If neither matches (tolerance 0.6 mm or
  0.5 %), the review screen shows both and asks which is right.
* **Dieline detection**, in this order:
  1. layers (optional content groups) and spot colours named like *Dieline, Die, Cut,
     CutContour, Crease, Stans, Rillijn, Vouw, Rainage…* (`classify_name`). Spot-coloured paths
     are identified exactly by temporarily rewriting each Separation to a unique sentinel colour.
     Solid strokes are cuts, dashed strokes are creases.
  2. fallback for flattened files: the thin stroke colour that draws the most long
     axis-aligned lines (preferably both solid and dashed). The UI then asks you to check.
  3. nothing found: a template grid from the file-name dimensions that you drag into place.
* **Panels**: the carton body is the band between two long horizontal folds crossed by ≥ 5
  vertical folds; four columns alternating width/depth are the main panels, flaps are found
  above/below each column (lid + tuck when there is an inner crease, otherwise dust flaps),
  the glue flap beside the body. Sheets drawn at 90° are recognised from the structure; an
  upside-down sheet from the reading direction of the live text.
* **Orientation**: each panel gets the clockwise rotation that makes it upright for its face
  (top seen from above with the front edge at the bottom; bottom seen from below with the
  front edge at the top). A top lid printed upside down on the sheet therefore gets 180°.
* **Front** is only *proposed*; you confirm it (or pick another panel) before anything renders.
* Layers/spot colours that may be non-printing (*white, Braille*) are not guessed: the review
  screen asks.

### 2. Panel review and crop (`project.py`, `raster.py`, `checks.py`)

* SVG overlay on the flat sheet: drag fold lines (0.05 mm steps), relabel, rotate 90/180,
  make front, turn the whole sheet. Labels are drawn in each panel's upright direction, so a
  wrong orientation is visible at a glance.
* Dieline marks are removed **in the PDF before rasterising**: content-stream operators painting
  in a dieline spot colour are dropped (every other byte is passed through), dieline/technical
  layers are switched off. Panels are then rasterised at 600 dpi (1200 dpi option) straight
  from the vector file with MuPDF into CMYK and converted to sRGB with LittleCMS
  (default ISO Coated v2 / FOGRA39, relative colorimetric + black-point compensation;
  FOGRA47/29, GRACoL, SWOP selectable). Nothing else touches the pixels.
* Each panel is cropped exactly on its fold lines (just inside them for flattened files, where
  the line itself is in the artwork).
* **Residue check**: pixels of the dieline colour (measured at 600 dpi on the original line)
  that form thin straight runs ≥ 4 mm inside a panel. Blobs (a magenta logo of the very same
  colour) are not counted.
* **Artwork warnings** (rendered as-is, never repaired): an unprinted or differently coloured
  strip along a fold (background not reaching the panel edge), likely missing word spaces in
  live text, placed images below 250 ppi.

### 3. Render (`blender_render.py`, run as a separate process per job)

* Closed box with the measured proportions, 0.3 mm bevelled edges, one material per face.
* Finishes: matte varnish, gloss varnish (clear coat), soft-touch (sheen); spot UV or foil on
  an uploaded mask per face (white = finish).
* Camera: level camera with lens shift (two-point perspective: verticals stay vertical),
  100 mm default (85–135), auto-framed. Presets 3/4 left, 3/4 right, front, top-down, hero;
  angle, height, frame fill and placement (e.g. right-aligned with room for copy) adjustable.
* Light: soft disc key light (casts the shadow), shadowless fill, dim white world. Before the
  final render a small calibration render with the real artwork is measured and all lights are
  scaled so the **front face renders at 93 % of the file's brightness**; the visible side is
  darker. View transform **Standard** (not Filmic/AgX).
* Shadow: Cycles shadow catcher on a transparent film (contact shadow + soft cast shadow), then
  the shadow-only pixels outside the box silhouette are forced to neutral black and faded out
  before the image border. Can be switched off; direction follows the key light.
* Group shot: other approved projects in a staggered row (spacing and depth offset).

### 4. Output (`export.py`)

* Long side 1000 (quick test) / 2000 / 4000 / 8000 px or custom; aspect 1:1, 4:5, 16:9, A4.
* PNG: RGBA with true transparency, sRGB profile embedded. JPG: on white or a chosen colour,
  quality 95, 4:4:4, sRGB embedded. PDF: the render on a page at 300 dpi with an optional info
  strip (product, dimensions, version, date code).
* Naming: `<source name>_<view>_<size>.<ext>`, e.g.
  `01-26 EG-Ferropti FORTE 1085x695x695mm 90comp DD 3_34-left_4000px.png`.
* ZIP per render and for all renders of a project.

### 5. Automatic verification on every render (`verify.py`)

* The projected corners of each visible face are exported from Blender; the rendered front is
  unwarped back to flat with a homography and compared with the source panel:
  * **structure** (fails the render): SSIM, edge agreement, residual shift, and the worst
    *local* edge difference (tiles of 4 % of the face, so a single missing letter is caught);
  * **colour**: mean CIEDE2000 with and without the smooth lighting gradient;
  * **lighting**: front and visible side brightness relative to the file.
* **Background**: nothing but neutral black shadow outside the box silhouette, fully
  transparent border; with shadow off, every pixel outside the box must be transparent.
* Shown as a pass/fail table with a side-by-side image (source · unwarped render · ΔE map).

### Library and presets

Every upload, its layout and its renders are kept (`/data/projects/<id>`). A new artwork
version on the same dieline (same measured box) offers **“Reuse its layout”** in the review
screen. The last camera/light/finish/output settings are restored automatically; named presets
can be saved.

## Status

Built in the stages of the brief. Working and tested end to end on the synthetic sample:
stage 1 (analysis + review), stage 2 (single render, export, verification), group shots, the
library with layout reuse, presets and ZIP export.

Not done yet:

* **Colour-range recolouring** (stage 3: recolour panel backgrounds to HEX/CMYK/Pantone while
  logo and text stay pixel-identical). The export already supports a "recoloured" label in the
  file name; the recolouring itself is next.
* Painting a foil/spot UV mask in the browser (upload works).
* Render time is CPU-bound: about 1 minute for a 1000 px view on 4 cores; 4000 px takes roughly
  10–15 minutes and 8000 px proportionally more. Add workers or a GPU build of Blender for speed.
* RGB objects inside a CMYK PDF are converted by MuPDF's default profiles before the FOGRA
  transform; files with an RGB output intent are not treated specially yet.
* Only straight-tuck / reverse-tuck style cartons (four body panels in a row) are recognised
  automatically; other constructions start from the template grid.

The ICC profiles in `backend/app/icc` come from the colord project (CC0; GRACoL/SWOP data
from CGATS/NPES technical reports).
