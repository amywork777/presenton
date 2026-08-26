import assert from "node:assert/strict";
import test from "node:test";
import { techPackToEditorPages } from "./techPackAdapter";
import { techPackExample } from "./techPackModel";

test("creates editable document pages while preserving Vizcom provenance", () => {
  const pages = techPackToEditorPages(techPackExample);

  assert.deepEqual(pages.map((page) => page.id), ["overview", "bom", "views"]);
  assert.match(JSON.stringify(pages[0].layout), /asset-real-sneaker-side/);
  assert.match(JSON.stringify(pages[1].layout), /region-upper/);
  assert.match(JSON.stringify(pages[2].layout), /new-view/i);
});

test("creates an editable table row for every Region Map part", () => {
  const pages = techPackToEditorPages(techPackExample);
  const elements = pages[1].layout.elements as Array<Record<string, unknown>>;
  const bom = elements.find((element) => element.type === "table") as { rows: unknown[] };

  assert.equal(bom.rows.length, techPackExample.parts.length);
});
