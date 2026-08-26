# Vizcom Tech Pack editor spike

This branch tests Presenton's editor as an embedded Vizcom document surface. It
does not treat Presenton as a separate user-facing app or as the manufacturing
source of truth.

## Run it

```bash
cd servers/nextjs
npm install
npm run dev -- --port 5190
```

Open `http://localhost:5190/tech-pack-spike`.

Generate the printable version from the same structured document:

```bash
npm run export:tech-pack-spike
```

The command writes `tech-pack-spike.pdf` at the repository root. It expects the
local route above to be running.

## Proven in this slice

- A Vizcom-owned `TechPackDocument` keeps the primary Workbench asset, New View
  workflow IDs, verification state, Region Map layer IDs, BOM values, and notes.
- An adapter turns that domain model into editable Presenton Template V2 pages.
- The editor uses the 17 × 11 inch landscape geometry from the footwear
  manufacturing references instead of the upstream slide ratio.
- `Create from template` offers a compact upper, a three-row component layout,
  and a two-page upper + graphic/sole detail layout.
- The sample includes a real sneaker source, Region Map-backed component cells,
  the required product/development header fields, vendor/material identifiers,
  honest pending states for missing New Views, numbered callouts, and custom
  sections.
- Region Map parts carry normalized alpha-mask anchors. The adapter mirrors
  PR #6709 by balancing labels across both sides of the product and connecting
  them to numbered badges with editable leader lines.
- Interactive mode exposes those callouts and fields as editable page elements;
  Static preview locks the same layout used by PDF/PNG export.
- Interactive mode opens on a Region Map inspector. Selecting a linked part
  focuses its source anchor on the product, while edits to its name, material,
  color, finish, or MPN regenerate every bound callout and specification cell.
  Static mode keeps the Region Map visible for review but locks its fields.
- The primary interactive surface now mirrors the shipped Region Maps feature:
  product-first canvas hit targets, hover/list synchronization, white selection
  glow, Shift/Command multi-selection, inline color swatches, palette apply,
  Show Original, Reset All, and a drill-in detail view with material presets.
- Interaction is split into three explicit states: Region Map editing, document
  annotation, and locked static preview. Region changes flow into the latter two.
- The local sneaker fixture uses hand-authored SVG proxy masks so the interaction
  can be tested without Vizcom drawing data. Production must substitute the real
  compositor label map and region masks already used by the Workbench feature.
- Interactive and static/PDF modes render the same page layout data.
- PDF export produces two real 17 × 11 inch pages through Chrome's print
  protocol with CSS page sizing enabled.

## Production boundary

Vizcom should continue to own `TechPackDocument`. Presenton's Template V2 JSON
is a layout representation behind an adapter, not the canonical product model.
The editor surface can then be brought into Vizcom with Vizcom auth, storage,
Workbench selection, Region Map data, and New View completion events.

## Next production slice

1. Mount the editor route in the Vizcom app shell.
2. Replace the fixture with a Workbench-created `TechPackDocument` payload.
3. Persist `onLayoutChange` edits through Vizcom's API instead of local state.
4. Let New View completion replace the pending view slots by workflow ID.
5. Populate the template picker from Vizcom-owned reusable section definitions,
   then add drag-to-reorder and drag-from-Workbench insertion.
6. Move PDF generation to a server-side export worker using the same print URL.
