import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import type { SlideElement } from "@/components/slide-editor/types";
import type { TechPackDocument, TechPackPart } from "./techPackModel";

export type TechPackTemplateId = "upper-one-page" | "upper-three-row" | "upper-two-page";

export type TechPackSectionType =
  | "cover"
  | "region-map"
  | "bom"
  | "views"
  | "construction-notes"
  | "blank";

export const TECH_PACK_SECTION_OPTIONS: Array<{
  id: TechPackSectionType;
  label: string;
  description: string;
}> = [
  { id: "region-map", label: "Region Map", description: "Live part callouts from Vizcom Regions" },
  { id: "bom", label: "Component / BOM", description: "Factory-ready component specification table" },
  { id: "views", label: "Product views", description: "Primary and generated product views" },
  { id: "construction-notes", label: "Construction notes", description: "Assembly instructions and review notes" },
  { id: "cover", label: "Cover", description: "Product identity, intent, and primary design" },
  { id: "blank", label: "Blank / custom", description: "An empty editable slide" },
];

export const TECH_PACK_TEMPLATES: Array<{
  id: TechPackTemplateId;
  label: string;
  description: string;
}> = [
  { id: "upper-one-page", label: "Upper · 1 page", description: "Compact factory handoff" },
  { id: "upper-three-row", label: "Upper · 3 rows", description: "More component capacity" },
  { id: "upper-two-page", label: "Upper · 2 pages", description: "Graphics and sole details" },
];

export type TechPackEditorPage = {
  id: string;
  title: string;
  sectionType: TechPackSectionType;
  sourceManaged: boolean;
  layout: TemplateV2Layout;
};

const pageWidth = 1224;
const pageHeight = 792;
const ink = "#202126";
const muted = "#747780";
const violet = "#615CF6";
const rule = "#E0E1E6";
const surface = "#F7F7F9";
const chrome = "#1B1C20";
const chromeMuted = "#A7A9B1";
const paper = "#FCFCFD";

function text(
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  options: { bold?: boolean; color?: string; name?: string; align?: "left" | "center" | "right" } = {},
): SlideElement {
  return {
    type: "text",
    position: { x, y },
    size: { width, height },
    alignment: { horizontal: options.align ?? "left", vertical: "top" },
    runs: [{ text: value }],
    font: {
      family: "Inter",
      size,
      color: options.color ?? ink,
      bold: options.bold ?? false,
      line_height: 1.15,
    },
    decorative: false,
    name: options.name ?? "text",
  };
}

function image(data: string, x: number, y: number, width: number, height: number, name: string): SlideElement {
  return {
    type: "image",
    position: { x, y },
    size: { width, height },
    data,
    fit: "contain",
    border_radius: { tl: 6, tr: 6, bl: 6, br: 6 },
    decorative: false,
    name,
  };
}

function rect(x: number, y: number, width: number, height: number, color: string, strokeColor?: string): SlideElement {
  return {
    type: "vector",
    shape: "polygon",
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    closed: true,
    fill: { color, opacity: 1 },
    stroke: strokeColor ? { color: strokeColor, opacity: 1, width: 1 } : null,
  };
}

function line(x1: number, y1: number, x2: number, y2: number, color = rule, width = 1): SlideElement {
  return {
    type: "vector",
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    closed: false,
    stroke: { color, opacity: 1, width },
  };
}

function ellipse(x: number, y: number, width: number, height: number, fill: string, strokeColor: string): SlideElement {
  return {
    type: "vector",
    shape: "ellipse",
    points: [
      { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
    ],
    closed: true,
    fill: { color: fill, opacity: 1 },
    stroke: { color: strokeColor, opacity: 1, width: 1.25 },
  };
}

function automaticCallouts(
  parts: TechPackPart[],
  imageRect: { x: number; y: number; width: number; height: number },
): SlideElement[] {
  const ranked = [...parts].sort((a, b) => a.anchor.x - b.anchor.x || a.anchor.y - b.anchor.y);
  const leftIds = new Set(ranked.slice(0, Math.ceil(parts.length / 2)).map((part) => part.id));
  const placeSide = (sideParts: TechPackPart[], side: "left" | "right") => {
    const sorted = [...sideParts].sort((a, b) => a.anchor.y - b.anchor.y);
    return sorted.flatMap((part, index) => {
      const sourceX = imageRect.x + part.anchor.x * imageRect.width;
      const sourceY = imageRect.y + part.anchor.y * imageRect.height;
      const span = 210;
      const labelY = sorted.length === 1 ? 260 : 152 + (span * index) / (sorted.length - 1);
      const isLeft = side === "left";
      const labelX = isLeft ? 34 : 776;
      const labelWidth = isLeft ? 142 : 140;
      const elbowX = isLeft ? 184 : 768;
      const lineEndX = isLeft ? labelX + labelWidth : labelX;
      const partIndex = parts.findIndex((candidate) => candidate.id === part.id) + 1;
      return [
        rect(labelX, labelY - 17, labelWidth, 42, surface),
        rect(isLeft ? labelX + labelWidth - 3 : labelX, labelY - 17, 3, 42, violet),
        {
          type: "vector" as const,
          points: [
            { x: sourceX, y: sourceY },
            { x: elbowX, y: sourceY },
            { x: lineEndX, y: labelY + 5 },
          ],
          closed: false,
          stroke: { color: violet, opacity: 0.7, width: 1.15 },
        },
        ellipse(sourceX - 11, sourceY - 11, 22, 22, violet, paper),
        text(String(partIndex).padStart(2, "0"), sourceX - 11, sourceY - 5, 22, 13, 7, {
          bold: true,
          color: paper,
          align: "center",
          name: `callout_${part.id}_badge`,
        }),
        text(`${String(partIndex).padStart(2, "0")}  ${part.name}`, labelX + 9, labelY - 9, labelWidth - 18, 13, 7, {
          bold: true,
          align: isLeft ? "right" : "left",
          name: `callout_${part.id}_label`,
        }),
        text(`${part.material} · ${part.colorName}`, labelX + 9, labelY + 7, labelWidth - 18, 16, 6, {
          color: muted,
          align: isLeft ? "right" : "left",
          name: `callout_${part.id}_detail`,
        }),
      ];
    });
  };
  return [
    ...placeSide(parts.filter((part) => leftIds.has(part.id)), "left"),
    ...placeSide(parts.filter((part) => !leftIds.has(part.id)), "right"),
  ];
}

function pendingView(x: number, y: number, width: number, height: number, label: string): SlideElement[] {
  return [
    rect(x, y, width, height, surface),
    rect(x, y, 3, height, violet),
    text(label, x + 14, y + 13, width - 28, 16, 8, { bold: true, color: ink }),
    text("Add view", x + 14, y + height / 2 - 6, width - 28, 18, 9, {
      color: muted,
      align: "center",
      name: `${label.toLowerCase()}_pending`,
    }),
  ];
}

function documentHeader(document: TechPackDocument, page: number, pageCount: number): SlideElement[] {
  const elements: SlideElement[] = [
    rect(32, 20, 1160, 48, chrome),
    text("VIZCOM", 48, 35, 58, 13, 10, { bold: true, color: paper }),
    rect(116, 34, 3, 16, violet),
    text("DOCS", 130, 36, 44, 11, 7, { bold: true, color: "#9E9AFF" }),
    text(document.title, 194, 28, 500, 16, 11, { bold: true, color: paper, name: "document_title" }),
    text(`Style ${document.styleNumber}`, 194, 47, 300, 10, 7, { color: chromeMuted }),
    text(document.header.currentDate, 880, 34, 170, 14, 7, { color: chromeMuted, align: "right" }),
    text(`PAGE ${page} / ${pageCount}`, 1064, 34, 112, 14, 7, { bold: true, color: paper, align: "right" }),
  ];
  return elements;
}

function componentTable(
  document: TechPackDocument,
  startY: number,
  parts: TechPackPart[] = document.parts,
  startIndex = 0,
  rowHeight = 19,
): SlideElement[] {
  const x = 32;
  const widths = [44, 190, 190, 250, 150, 336];
  const labels = ["#", "COMPONENT", "COLOR", "MATERIAL", "FINISH", "SUPPLIER / REFERENCE"];
  const headerHeight = 26;
  const columnX = widths.reduce<number[]>((positions, width) => {
    positions.push(positions.at(-1)! + width);
    return positions;
  }, [x]);
  const elements: SlideElement[] = [
    rect(x, startY, 1160, headerHeight, chrome),
    line(x, startY + headerHeight, x + 1160, startY + headerHeight, rule),
  ];
  labels.forEach((label, index) => {
    elements.push(text(label, columnX[index] + 8, startY + 8, widths[index] - 16, 11, 7, {
      bold: true,
      color: chromeMuted,
    }));
  });
  parts.forEach((part, index) => {
    const rowY = startY + headerHeight + index * rowHeight;
    if (index % 2 === 1) elements.push(rect(x, rowY, 1160, rowHeight, surface));
    if (index > 0) elements.push(line(x, rowY, x + 1160, rowY, rule));
    elements.push(text(String(startIndex + index + 1).padStart(2, "0"), x + 8, rowY + 6, widths[0] - 16, 10, 7, {
      bold: true,
      color: muted,
    }));
    elements.push(text(part.name, columnX[1] + 8, rowY + 7, widths[1] - 16, 11, 8, {
      bold: true,
      name: `part_${part.id}_name`,
    }));
    elements.push(rect(columnX[2] + 8, rowY + 6, 12, 12, part.colorHex, "#BFC1C8"));
    elements.push(text(`${part.colorName}  ${part.colorHex}`, columnX[2] + 28, rowY + 7, widths[2] - 36, 10, 7));
    elements.push(text(part.material, columnX[3] + 8, rowY + 7, widths[3] - 16, 10, 7, {
      color: part.material === "Not specified" ? violet : ink,
    }));
    elements.push(text(part.finish, columnX[4] + 8, rowY + 7, widths[4] - 16, 10, 7, { color: muted }));
    elements.push(text(
      [part.supplier, part.vendorItemIdentifier, part.materialPartNumber].filter((value) => value && value !== "TBD").join(" · ") || "TBD",
      columnX[5] + 8,
      rowY + 7,
      widths[5] - 16,
      10,
      7,
      { color: muted },
    ));
  });
  return elements;
}

function colorSwatchTable(document: TechPackDocument, startY: number): SlideElement[] {
  const columns = 3;
  const gap = 8;
  const width = (550 - gap * (columns - 1)) / columns;
  const rowHeight = 50;
  return document.parts.flatMap((part, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 632 + column * (width + gap);
    const y = startY + row * (rowHeight + gap);
    return [
      rect(x, y, width, rowHeight, surface),
      rect(x + 9, y + 10, 22, 22, part.colorHex, "#BFC1C8"),
      text(part.name, x + 40, y + 9, width - 48, 13, 7, { bold: true }),
      text(`${part.colorName} · ${part.colorHex}`, x + 40, y + 27, width - 48, 12, 6, { color: muted }),
    ];
  });
}

function layout(id: string, description: string, elements: SlideElement[]): TemplateV2Layout {
  return { id, description, background: paper, elements } as TemplateV2Layout;
}

const MAIN_TABLE_ROW_LIMIT = 12;
const CONTINUATION_TABLE_ROW_LIMIT = 24;
const SUPPORTING_IMAGES_PER_PAGE = 6;

function mainSpecificationPage(document: TechPackDocument): TechPackEditorPage {
  const primary = document.views.find((view) => view.label === "Primary") ?? document.views[0];
  const top = document.views.find((view) => view.label === "Top");
  const heel = document.views.find((view) => view.label === "Heel");
  const primaryImageRect = { x: 188, y: 124, width: 572, height: 300 };
  return {
    id: "upper-specification",
    title: "Upper specification",
    sectionType: "region-map",
    sourceManaged: true,
    layout: layout("tech-pack-upper-specification", "Region Map-backed upper specification", [
      ...documentHeader(document, 1, 1),
      rect(32, 84, 4, 18, violet),
      text("UPPER SPECIFICATION", 46, 85, 260, 20, 11, { bold: true, color: ink }),
      text("Region map · Materials", 815, 86, 377, 16, 8, { color: muted, align: "right" }),
      line(32, 108, 1192, 108, rule),
      rect(176, 120, 596, 310, surface),
      image(primary.imageUrl ?? document.primarySource.imageUrl, primaryImageRect.x, primaryImageRect.y, primaryImageRect.width, primaryImageRect.height, "primary_lateral_view"),
      ...automaticCallouts(document.parts, primaryImageRect),
      text("Selected primary design · Lateral", 188, 436, 572, 16, 7, { color: muted, align: "center" }),
      ...(top?.imageUrl ? [image(top.imageUrl, 932, 124, 116, 142, "top_view")] : pendingView(932, 124, 116, 142, "Top")),
      ...(heel?.imageUrl ? [image(heel.imageUrl, 1062, 124, 130, 142, "heel_view")] : pendingView(1062, 124, 130, 142, "Heel")),
      rect(932, 280, 260, 144, chrome),
      rect(932, 280, 4, 144, violet),
      text("DESIGN INTENT", 952, 298, 150, 14, 8, { bold: true, color: "#9E9AFF" }),
      text(document.intent, 952, 324, 220, 80, 9, { color: paper, name: "design_intent" }),
      rect(32, 460, 4, 16, violet),
      text("COMPONENT SPECIFICATIONS", 46, 462, 470, 14, 8, { bold: true, color: ink }),
      ...componentTable(document, 482, document.parts.slice(0, MAIN_TABLE_ROW_LIMIT)),
    ]),
  };
}

function componentContinuationPages(document: TechPackDocument): TechPackEditorPage[] {
  const remaining = document.parts.slice(MAIN_TABLE_ROW_LIMIT);
  const chunks = Array.from(
    { length: Math.ceil(remaining.length / CONTINUATION_TABLE_ROW_LIMIT) },
    (_, index) => remaining.slice(
      index * CONTINUATION_TABLE_ROW_LIMIT,
      (index + 1) * CONTINUATION_TABLE_ROW_LIMIT,
    ),
  );

  return chunks.map((parts, pageIndex) => {
    const startIndex = MAIN_TABLE_ROW_LIMIT + pageIndex * CONTINUATION_TABLE_ROW_LIMIT;
    const endIndex = startIndex + parts.length;
    return {
      id: `component-specifications-${pageIndex + 2}`,
      title: `Component specifications · ${pageIndex + 2}`,
      sectionType: "bom" as const,
      sourceManaged: true,
      layout: layout(
        `tech-pack-component-specifications-${pageIndex + 2}`,
        "Continued Region Map component specification table",
        [
          ...documentHeader(document, 1, 1),
          rect(32, 84, 4, 18, violet),
          text("COMPONENT SPECIFICATIONS · CONTINUED", 46, 85, 600, 20, 11, {
            bold: true,
            color: ink,
          }),
          text(
            `${String(startIndex + 1).padStart(2, "0")}–${String(endIndex).padStart(2, "0")} OF ${document.parts.length}`,
            852,
            86,
            340,
            16,
            8,
            { bold: true, color: muted, align: "right" },
          ),
          line(32, 108, 1192, 108, rule),
          text("REGION MAP-LINKED COMPONENTS", 32, 128, 600, 14, 8, { bold: true, color: ink }),
          ...componentTable(document, 154, parts, startIndex, 22),
        ],
      ),
    };
  });
}

function detailPage(document: TechPackDocument): TechPackEditorPage {
  const top = document.views.find((view) => view.label === "Top");
  const heel = document.views.find((view) => view.label === "Heel");
  return {
    id: "graphic-sole-details",
    title: "Graphic & sole details",
    sectionType: "views",
    sourceManaged: true,
    layout: layout("tech-pack-graphic-sole-details", "Optional graphic, cross-section, and sole detail page", [
      ...documentHeader(document, 2, 2),
      rect(42, 86, 4, 18, violet),
      text("GRAPHIC DETAILS", 56, 87, 506, 20, 12, { bold: true, color: ink }),
      rect(632, 86, 4, 18, violet),
      text("SOLE UNIT DETAILS", 646, 87, 506, 20, 12, { bold: true, color: ink }),
      line(612, 86, 612, 746, rule), line(42, 113, 582, 113, rule), line(632, 113, 1182, 113, rule),
      rect(42, 130, 540, 250, surface),
      text("DROP A GRAPHIC OR CROSS-SECTION HERE", 74, 234, 476, 20, 11, { bold: true, color: muted, align: "center" }),
      ...(top?.imageUrl ? [image(top.imageUrl, 652, 130, 250, 250, "sole_top_view")] : pendingView(652, 130, 250, 250, "Outsole / top")),
      ...(heel?.imageUrl ? [image(heel.imageUrl, 922, 130, 240, 250, "heel_detail_view")] : pendingView(922, 130, 240, 250, "Heel")),
      text("CONSTRUCTION + REVIEW NOTES", 42, 416, 410, 18, 10, { bold: true, color: ink }),
      rect(42, 443, 540, 290, surface),
      text(document.constructionNotes.map((note, index) => `${index + 1}. ${note}`).join("\n\n"), 62, 463, 500, 240, 10, { name: "construction_notes" }),
      text("COLOR SWATCHES", 632, 416, 250, 18, 10, { bold: true, color: ink }),
      ...colorSwatchTable(document, 443),
    ]),
  };
}

function sourceSectionPages(document: TechPackDocument): TechPackEditorPage[] {
  const sourceSection = document.sourceSection!;
  const allImageAssets = sourceSection.assets.filter((asset) => asset.imageUrl);
  const textAssets = sourceSection.assets.filter((asset) => asset.text);
  const imageChunks = allImageAssets.length > 0
    ? Array.from(
        { length: Math.ceil(allImageAssets.length / SUPPORTING_IMAGES_PER_PAGE) },
        (_, index) => allImageAssets.slice(
          index * SUPPORTING_IMAGES_PER_PAGE,
          (index + 1) * SUPPORTING_IMAGES_PER_PAGE,
        ),
      )
    : [[]];
  return imageChunks.map((imageAssets, pageIndex) => {
    const singleImage = imageAssets.length === 1;
    const cardWidth = singleImage ? 736 : 360;
    const cardHeight = singleImage ? 360 : 158;
    const imageElements = imageAssets.flatMap((asset, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 32 + column * (cardWidth + 16);
      const y = 146 + row * (cardHeight + 12);
      return [
        rect(x, y, cardWidth, cardHeight, surface),
        image(asset.imageUrl!, x + 10, y + 8, cardWidth - 20, cardHeight - 42, `source_asset_${asset.id}`),
        text(asset.title, x + 12, y + cardHeight - 25, cardWidth - 24, 14, 8, { bold: true }),
      ];
    });
    const listedAssets = pageIndex === 0
      ? sourceSection.assets
      : imageAssets;
    const sourceList = listedAssets.map((asset) => {
      const sourceIndex = sourceSection.assets.findIndex((candidate) => candidate.id === asset.id);
      const detail = asset.kind === "image"
        ? "Image"
        : asset.kind === "color-swatch"
          ? `${asset.colors?.length ?? 0} colors`
          : asset.kind.replace("-", " ");
      return `${String(sourceIndex + 1).padStart(2, "0")}  ${asset.title} · ${detail}`;
    });
    const suffix = pageIndex === 0 ? "" : ` · ${pageIndex + 1}`;
    return {
      id: `vizcom-section-sources${pageIndex === 0 ? "" : `-${pageIndex + 1}`}`,
      title: `${sourceSection.title}${suffix}`,
      sectionType: "views" as const,
      sourceManaged: true,
      layout: layout(
        `tech-pack-vizcom-section-sources-${pageIndex + 1}`,
        "Supporting content synced from a Vizcom Section",
        [
          ...documentHeader(document, 1, 1),
          rect(32, 84, 4, 18, violet),
          text(`VIZCOM TECH PACK SECTION${pageIndex === 0 ? "" : " · CONTINUED"}`, 46, 85, 520, 20, 11, { bold: true, color: ink }),
          text(sourceSection.title.toUpperCase(), 676, 86, 516, 16, 8, { color: muted, align: "right" }),
          line(32, 108, 1192, 108, rule),
          text("SUPPORTING IMAGES", 32, 124, 736, 14, 8, { bold: true, color: muted }),
          ...(imageElements.length > 0
            ? imageElements
            : pendingView(32, 146, 736, 508, "Drag images into this Vizcom Section")),
          rect(784, 146, 408, 508, chrome),
          rect(784, 146, 4, 508, violet),
          text(pageIndex === 0 ? "LINKED WORKBENCH ITEMS" : "ITEMS ON THIS PAGE", 806, 168, 364, 16, 8, { bold: true, color: "#9E9AFF" }),
          text(sourceList.join("\n\n") || "No supporting items yet.", 806, 202, 364, 250, 9, { color: paper, name: `source_section_assets_${pageIndex + 1}` }),
          ...(pageIndex === 0 && textAssets.length > 0
            ? [
                line(806, 472, 1170, 472, "#3A3C43"),
                text("NOTES", 806, 490, 364, 14, 8, { bold: true, color: "#9E9AFF" }),
                text(textAssets.map((asset) => asset.text).join("\n\n"), 806, 520, 364, 108, 9, { color: paper, name: "source_section_notes" }),
              ]
            : []),
          text("Synced from the selected Vizcom Docs Section", 32, 684, 736, 14, 7, { color: muted }),
          text(`${sourceSection.assets.length} linked item${sourceSection.assets.length === 1 ? "" : "s"} · ${allImageAssets.length} image${allImageAssets.length === 1 ? "" : "s"}`, 784, 684, 408, 14, 7, { color: muted, align: "right" }),
        ],
      ),
    };
  });
}

export function techPackToEditorPages(document: TechPackDocument, templateId: TechPackTemplateId = "upper-two-page"): TechPackEditorPage[] {
  const pages = [mainSpecificationPage(document), ...componentContinuationPages(document)];
  if (templateId === "upper-two-page") {
    pages.push(...(document.sourceSection ? sourceSectionPages(document) : [detailPage(document)]));
  }
  return numberTechPackPages(pages);
}

function sectionHeader(document: TechPackDocument, title: string): SlideElement[] {
  return [
    ...documentHeader(document, 1, 1),
    rect(32, 84, 4, 18, violet),
    text(title.toUpperCase(), 46, 85, 606, 20, 11, { bold: true, color: ink }),
    line(32, 108, 1192, 108, rule),
  ];
}

function regionMapSection(document: TechPackDocument): TemplateV2Layout {
  const primary = document.views.find((view) => view.label === "Primary") ?? document.views[0];
  const imageRect = { x: 224, y: 142, width: 776, height: 444 };
  return layout("tech-pack-section-region-map", "Live Vizcom Region Map callouts", [
    ...sectionHeader(document, "Region Map"),
    image(primary.imageUrl ?? document.primarySource.imageUrl, imageRect.x, imageRect.y, imageRect.width, imageRect.height, "region_map_primary"),
    ...automaticCallouts(document.parts, imageRect),
    text("Live Vizcom Regions · Edit names, colors, materials, and masks on the workbench", 224, 606, 776, 16, 7, { color: muted, align: "center" }),
    rect(224, 644, 776, 78, chrome),
    rect(224, 644, 4, 78, violet),
    text("DESIGN INTENT", 244, 660, 140, 14, 8, { bold: true, color: "#9E9AFF" }),
    text(document.intent, 390, 658, 586, 44, 9, { color: paper, name: "region_map_intent" }),
  ]);
}

function bomSection(document: TechPackDocument): TemplateV2Layout {
  return layout("tech-pack-section-bom", "Component and bill of materials table", [
    ...sectionHeader(document, "Component / BOM"),
    text("Structured from the selected design's live Region Map parts", 32, 126, 720, 15, 8, { color: muted }),
    text(`${document.parts.length} COMPONENTS`, 952, 126, 240, 15, 8, { bold: true, color: violet, align: "right" }),
    ...componentTable(document, 158),
  ]);
}

function viewsSection(document: TechPackDocument): TemplateV2Layout {
  const primary = document.views.find((view) => view.label === "Primary") ?? document.views[0];
  const top = document.views.find((view) => view.label === "Top");
  const heel = document.views.find((view) => view.label === "Heel");
  return layout("tech-pack-section-views", "Selected and generated product views", [
    ...sectionHeader(document, "Product views"),
    text("PRIMARY / LATERAL", 32, 128, 692, 16, 8, { bold: true, color: muted }),
    image(primary.imageUrl ?? document.primarySource.imageUrl, 32, 154, 700, 498, "views_primary"),
    text("TOP", 764, 128, 428, 16, 8, { bold: true, color: muted }),
    ...(top?.imageUrl ? [image(top.imageUrl, 764, 154, 428, 230, "views_top")] : pendingView(764, 154, 428, 230, "Top")),
    text("HEEL / REAR", 764, 408, 428, 16, 8, { bold: true, color: muted }),
    ...(heel?.imageUrl ? [image(heel.imageUrl, 764, 434, 428, 218, "views_heel")] : pendingView(764, 434, 428, 218, "Heel")),
    text("Every generated view remains linked to the selected primary source asset.", 32, 682, 1160, 18, 8, { color: muted }),
  ]);
}

function constructionNotesSection(document: TechPackDocument): TemplateV2Layout {
  return layout("tech-pack-section-construction-notes", "Construction and review notes", [
    ...sectionHeader(document, "Construction notes"),
    rect(32, 134, 718, 590, surface),
    rect(32, 134, 4, 590, violet),
    text("ASSEMBLY + REVIEW", 54, 158, 670, 18, 9, { bold: true, color: ink }),
    text(document.constructionNotes.map((note, index) => `${String(index + 1).padStart(2, "0")}   ${note}`).join("\n\n"), 54, 198, 670, 470, 13, { name: "construction_notes_section" }),
    rect(782, 134, 410, 590, chrome),
    text("COMPONENT REFERENCE", 806, 158, 362, 18, 9, { bold: true, color: "#9E9AFF" }),
    ...document.parts.flatMap((part, index) => {
      const y = 204 + index * Math.min(92, 448 / Math.max(1, document.parts.length));
      return [
        rect(806, y, 18, 18, part.colorHex, "#BFC1C8"),
        text(`${String(index + 1).padStart(2, "0")}  ${part.name}`, 836, y, 320, 15, 9, { bold: true, color: paper }),
        text(`${part.material} · ${part.finish}`, 836, y + 22, 320, 28, 7, { color: chromeMuted }),
      ];
    }),
  ]);
}

function coverSection(document: TechPackDocument): TemplateV2Layout {
  const primary = document.views.find((view) => view.label === "Primary") ?? document.views[0];
  return layout("tech-pack-section-cover", "Tech Pack cover", [
    rect(0, 0, pageWidth, pageHeight, surface),
    rect(0, 0, 304, pageHeight, chrome),
    rect(304, 0, 6, pageHeight, violet),
    text("VIZCOM", 54, 54, 190, 24, 18, { bold: true, color: "#FFFFFF" }),
    text("TECH PACK", 54, 88, 190, 16, 9, { bold: true, color: "#AAA7FF" }),
    text(document.title, 54, 246, 210, 120, 28, { bold: true, color: "#FFFFFF", name: "cover_title" }),
    text(`STYLE ${document.styleNumber}\nREVISION ${document.revision}\n${document.header.currentDate}`, 54, 392, 210, 90, 10, { color: "#C9CBD2" }),
    image(primary.imageUrl ?? document.primarySource.imageUrl, 354, 92, 816, 500, "cover_primary"),
    text("DESIGN INTENT", 354, 632, 150, 16, 9, { bold: true, color: violet }),
    text(document.intent, 354, 660, 816, 58, 12, { name: "cover_intent" }),
  ]);
}

function blankSection(): TemplateV2Layout {
  return layout("tech-pack-section-blank", "Blank editable Tech Pack section", [
    rect(0, 0, pageWidth, pageHeight, paper),
    rect(48, 44, 4, 18, violet),
    text("CUSTOM SECTION", 62, 45, 286, 20, 10, { bold: true, color: ink }),
    line(48, 78, 1176, 78, rule),
  ]);
}

export function createTechPackSectionPage(
  document: TechPackDocument,
  sectionType: TechPackSectionType,
  instanceId: string,
): TechPackEditorPage {
  const option = TECH_PACK_SECTION_OPTIONS.find((candidate) => candidate.id === sectionType)!;
  const layouts: Record<TechPackSectionType, () => TemplateV2Layout> = {
    cover: () => coverSection(document),
    "region-map": () => regionMapSection(document),
    bom: () => bomSection(document),
    views: () => viewsSection(document),
    "construction-notes": () => constructionNotesSection(document),
    blank: blankSection,
  };
  return {
    id: `custom-${sectionType}-${instanceId}`,
    title: option.label,
    sectionType,
    sourceManaged: false,
    layout: layouts[sectionType](),
  };
}

export function numberTechPackPages(pages: TechPackEditorPage[]): TechPackEditorPage[] {
  return pages.map((page, index) => {
    const elements = page.layout.elements as SlideElement[];
    return {
      ...page,
      layout: {
        ...page.layout,
        elements: elements.map((element) => {
          if (element.type !== "text" || !element.runs?.length) return element;
          const current = element.runs.map((run) => "text" in run ? run.text : "").join("");
          if (!/^PAGE \d+ \/ \d+$/.test(current)) return element;
          return {
            ...element,
            runs: [{ ...element.runs[0], text: `PAGE ${index + 1} / ${pages.length}` }],
          };
        }),
      },
    };
  });
}

export const TECH_PACK_PAGE_SIZE = { width: pageWidth, height: pageHeight } as const;
