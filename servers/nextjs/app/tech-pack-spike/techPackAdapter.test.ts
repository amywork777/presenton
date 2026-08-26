import assert from "node:assert/strict";
import test from "node:test";
import { TECH_PACK_PAGE_SIZE, createTechPackSectionPage, techPackToEditorPages } from "./techPackAdapter";
import { techPackExample } from "./techPackModel";

test("creates editable document pages while preserving Vizcom provenance", () => {
  const pages = techPackToEditorPages(techPackExample);

  assert.deepEqual(pages.map((page) => page.id), ["upper-specification", "vizcom-section-sources"]);
  assert.ok(pages.every((page) => page.sourceManaged));
  assert.match(JSON.stringify(pages[0].layout), /real-sneaker-side/);
  assert.match(JSON.stringify(pages[0].layout), /part-upper/);
  assert.match(JSON.stringify(pages[1].layout), /asset-material-detail/i);
});

test("creates an editable table row for every Region Map part", () => {
  const page = createTechPackSectionPage(techPackExample, "bom", "test");
  const elements = page.layout.elements as Array<{ name?: string }>;
  const partNames = elements.filter((element) => element.name?.startsWith("part_"));

  assert.equal(partNames.length, techPackExample.parts.length);
  assert.equal(page.sourceManaged, false);
  assert.equal(page.sectionType, "bom");
});

test("paginates long Region tables and preserves every linked supporting image", () => {
  const document = structuredClone(techPackExample);
  const sourcePart = document.parts[0];
  document.parts = Array.from({ length: 18 }, (_, index) => ({
    ...sourcePart,
    id: `part-${index + 1}`,
    regionLayerId: `region-${index + 1}`,
    name: `Region ${index + 1}`,
  }));
  document.sourceSection!.assets = Array.from({ length: 7 }, (_, index) => ({
    id: `support-${index + 1}`,
    kind: "image" as const,
    title: `Supporting image ${index + 1}`,
    sourceElementType: "Drawing",
    imageUrl: `/support-${index + 1}.png`,
  }));

  const pages = techPackToEditorPages(document);
  assert.deepEqual(pages.map((page) => page.id), [
    "upper-specification",
    "component-specifications-2",
    "vizcom-section-sources",
    "vizcom-section-sources-2",
  ]);

  const serializedPages = JSON.stringify(pages);
  document.sourceSection!.assets.forEach((asset) => {
    assert.match(serializedPages, new RegExp(`source_asset_${asset.id}`));
  });
  document.parts.forEach((part) => {
    assert.match(serializedPages, new RegExp(`part_${part.id}_name`));
  });

  pages.forEach((page) => {
    const elements = page.layout.elements as Array<{
      position?: { y: number };
      size?: { height: number };
      points?: Array<{ y: number }>;
    }>;
    elements.forEach((element) => {
      if (element.position && element.size) {
        assert.ok(
          element.position.y + element.size.height <= TECH_PACK_PAGE_SIZE.height,
          `${page.id} has an element below the printable page`,
        );
      }
      element.points?.forEach((point) => {
        assert.ok(point.y <= TECH_PACK_PAGE_SIZE.height, `${page.id} has vector content below the printable page`);
      });
    });
  });
});
