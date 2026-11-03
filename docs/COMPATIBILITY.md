# Feature compatibility matrix

What the deterministic engine converts, per input source. "Verified" means covered by an automated test that
runs in this repository; it does **not** mean pixel-perfect.

Sources: **REST** = Figma REST API (`GET /v1/files/:key`), **.fig** = native file, **Screenshot** = reference image only.

> **Honesty note on `.fig`:** no real `.fig` file produced by the Figma app was available while building this.
> The container reader (ZIP wrapper, `fig-kiwi` header, deflate/zstd chunks, embedded Kiwi schema, message decode) and the
> tree assembly are tested against files built with that same layout and a reduced schema. Field names follow the
> community-reverse-engineered Kiwi schema. **Treat `.fig` support as unverified against real files** until you run it on
> yours; anything the parser does not understand is surfaced in the import warnings / conversion report, never dropped silently.

REST adapter fixtures (`tests/fixtures/landing.rest.json`) are authored in the exact JSON shape the REST API returns
(they are not captured from a live file). The URL-import code path (auth header, 403/404/429 handling with retry,
image-fill and SVG downloads, storage) is exercised against a local stand-in for `api.figma.com`.

## Node types

| Node | REST | .fig | Output |
|---|---|---|---|
| Page / Canvas | ✅ | ✅ | selection scope (a page selects its top-level frames) |
| Frame, Component, Component set, Section, Group | ✅ | ✅ | `div` / semantic tag from layer name |
| Instance | ✅ | ✅¹ | container; same-structure instances become one React component |
| Text | ✅ | ✅ | `h1–h4` / `p` / `span` / `a` |
| Rectangle, Rounded rectangle | ✅ | ✅ | `div`; sole image fill → `<img>` |
| Ellipse | ✅ | ✅ | `div` with `border-radius: 50%` |
| Line | ✅ | ✅ | zero-height `div` with border (SVG if exported) |
| Vector, Boolean operation, Star, Polygon | ✅ (SVG export) | ⚠️ path blobs decoded, unverified | `<img>` of an SVG asset; empty sized box + report entry if unavailable |
| Slice, Sticky, Table, Widget, Connector… | ❌ | ❌ | **reported as unsupported**, skipped |

¹ If a `.fig` instance has no stored children, it is expanded from its main component **without overrides** (reported).

## Layout

| Figma | CSS | Notes |
|---|---|---|
| Auto Layout horizontal / vertical | `display:flex` + `flex-direction` | ✅ |
| Item spacing | `gap` (`row-gap` for wrap) | ✅ |
| Padding | `padding` | ✅ |
| Primary / counter alignment | `justify-content` / `align-items` | space-between, center, min, max, baseline |
| Fixed size | `width`/`height` (`min-height` on flex containers so content can reflow) | ✅ |
| Hug contents | no explicit size | ✅ |
| Fill container | `flex: 1 1 0` (main axis) / `align-self: stretch` (cross axis) | ✅ |
| Wrap | `flex-wrap` | ✅ |
| Absolutely positioned child in Auto Layout | `position:absolute` + constraints | ✅ |
| Constraints (left/right/center/stretch/scale) | `left`/`right`/`margin` / `%` | ✅ |
| **No Auto Layout** | flow layout **inferred from child geometry** (non-overlapping, consistently aligned); otherwise constraint-based absolute positioning | ⚠️ heuristic, reported as an approximation |
| Rotation | `transform: rotate()` about the centre | ⚠️ approximation |
| Min/max width, layout grids, `itemReverseZIndex` | ❌ | ignored; grids reported |

Responsive heuristics (can be disabled; each use is reported): rows wider than 640px with ≥2 box children stack below
768px; side padding above 32px is capped at 24px; text ≥ 40px scales to 60%.

## Typography

Font family (Google Fonts link + generic fallback), size, weight (numeric or from style name), italic, line height
(px / %), letter spacing, horizontal alignment, vertical alignment (single-run text), decoration, case, auto-resize
(hug / fixed), truncation (ellipsis), hyperlinks, **mixed styles within one text node** (REST ✅, .fig ⚠️ partial).
Not supported: OpenType features, variable-font axes, paragraph spacing/indent, list styles, text on a path.

## Fills, strokes, effects

| Feature | Support |
|---|---|
| Solid fills, opacity | ✅ |
| Multiple fills | ✅ (stacked backgrounds) |
| Linear gradient | ✅ angle derived from handles (non-square boxes approximate) |
| Radial / angular / diamond gradient | ⚠️ approximated (reported) |
| Image fills (fill / fit / tile / stretch) | ✅ real files in `assets/`, never base64 |
| Strokes: inside | ✅ `border` (per-side weights supported) |
| Strokes: outside / centre | ⚠️ `outline` (centre approximated) |
| Dashed strokes | ✅ `dashed` |
| Gradient strokes, multiple strokes | ⚠️ solid approximation (reported) |
| Corner radius (uniform / per corner) | ✅ |
| Drop shadow, inner shadow | ✅ `box-shadow` (`text-shadow` on text; inner on text unsupported) |
| Layer blur / background blur | ⚠️ `filter`/`backdrop-filter` with radius/2 (reported) |
| Blend modes | ✅ common modes via `mix-blend-mode`, others reported |
| Masks | ❌ reported |
| Clip content | ✅ `overflow:hidden` |

## Components

Detected by **exact structural repetition** (tag, styles, structure — ignoring text content, image sources and placement)
including Figma instances. Differing text/images become props. Each top-level block of a page also becomes a section
component. No semantic/"fuzzy" recognition is attempted. HTML output shares CSS classes instead of components.

## Assets

Image fills → `assets/images/<ref>.<ext>` (PNG/JPG/WebP validated by magic bytes). Vectors → `assets/svg/*.svg`
(REST export; .fig path-blob decoding unverified). Failures are listed under "Asset extraction failures".

## Known limitations

- Output is deterministic and clean but **not pixel-perfect**; browsers lay out text with their own font metrics.
- Prototype interactions, animations, variables/modes, component variants/properties, and Dev-mode annotations are not converted.
- Screenshots carry no structure and are intentionally **not** converted.
- React/Next previews in Code Studio are transpiled in a sandboxed iframe (not a full bundler build). The exported
  project is what you should `npm install && npm run build`; the test-suite does exactly that.
