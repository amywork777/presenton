import assert from "node:assert/strict";
import test from "node:test";
import { createTechPackSectionPage, techPackToEditorPages } from "./techPackAdapter";
import { techPackExample } from "./techPackModel";

test("creates editable document pages while preserving Vizcom provenance", () => {
  const pages = techPackToEditorPages(techPackExample);

  assert.deepEqual(pages.map((page) => page.id), ["upper-specification", "graphic-sole-details"]);
  assert.ok(pages.every((page) => page.sourceManaged));
  assert.match(JSON.stringify(pages[0].layout), /real-sneaker-side/);
  assert.match(JSON.stringify(pages[0].layout), /part-upper/);
  assert.match(JSON.stringify(pages[1].layout), /pending/i);
});

test("creates an editable table row for every Region Map part", () => {
  const page = createTechPackSectionPage(techPackExample, "bom", "test");
  const elements = page.layout.elements as Array<{ name?: string }>;
  const partNames = elements.filter((element) => element.name?.startsWith("part_"));

  assert.equal(partNames.length, techPackExample.parts.length);
  assert.equal(page.sourceManaged, false);
  assert.equal(page.sectionType, "bom");
});
