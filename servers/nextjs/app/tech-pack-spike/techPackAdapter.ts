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
const ink = "#17181C";
const muted = "#686B73";
const violet = "#5B55F7";
const violetSoft = "#EEEDFF";
const rule = "#C9CBD2";
const paper = "#FFFFFF";

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
      family: "Arial",
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
        rect(labelX, labelY - 18, labelWidth, 46, paper, rule),
        {
          type: "vector" as const,
          points: [
            { x: sourceX, y: sourceY },
            { x: elbowX, y: sourceY },
            { x: lineEndX, y: labelY + 5 },
          ],
          closed: false,
          stroke: { color: "#8A8A8F", opacity: 1, width: 1 },
        },
        ellipse(sourceX - 12, sourceY - 12, 24, 24, paper, ink),
        text(String(partIndex).padStart(2, "0"), sourceX - 12, sourceY - 6, 24, 14, 7, {
          bold: true,
          align: "center",
          name: `callout_${part.id}_badge`,
        }),
        text(`${String(partIndex).padStart(2, "0")}  ${part.name.toUpperCase()}`, labelX + 8, labelY - 10, labelWidth - 16, 13, 7, {
          bold: true,
          align: isLeft ? "right" : "left",
          name: `callout_${part.id}_label`,
        }),
        text(`${part.material} · ${part.colorName}`, labelX + 8, labelY + 7, labelWidth - 16, 16, 6, {
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
    rect(x, y, width, height, "#F7F7F9", rule),
    text(label.toUpperCase(), x + 16, y + 14, width - 32, 16, 9, { bold: true, color: violet }),
    text("NEW VIEW\nOUTPUT PENDING", x + 16, y + height / 2 - 18, width - 32, 44, 11, {
      bold: true,
      color: muted,
      align: "center",
      name: `${label.toLowerCase()}_pending`,
    }),
  ];
}

function documentHeader(document: TechPackDocument, page: number, pageCount: number): SlideElement[] {
  const elements: SlideElement[] = [
    rect(32, 24, pageWidth - 64, 44, paper, ink),
    rect(32, 24, 92, 44, ink),
    text("VIZCOM", 42, 33, 72, 15, 12, { bold: true, color: "#FFFFFF" }),
    text("TECH PACK", 42, 50, 72, 10, 6, { bold: true, color: "#AAA7FF" }),
    text(document.title, 142, 32, 500, 16, 11, { bold: true, name: "document_title" }),
    text(`STYLE ${document.styleNumber}`, 142, 51, 320, 10, 7, { color: muted }),
    text(document.header.currentDate, 900, 33, 170, 14, 8, { bold: true, align: "right" }),
    text(`PAGE ${page} / ${pageCount}`, 1080, 33, 96, 14, 8, { bold: true, align: "right" }),
  ];
  return elements;
}

function componentTable(document: TechPackDocument, startY: number): SlideElement[] {
  const x = 32;
  const widths = [44, 190, 190, 250, 150, 336];
  const labels = ["#", "COMPONENT", "COLOR", "MATERIAL", "FINISH", "SUPPLIER / REFERENCE"];
  const headerHeight = 26;
  const rowHeight = Math.max(18, Math.min(30, 260 / Math.max(1, document.parts.length)));
  const totalHeight = headerHeight + rowHeight * document.parts.length;
  const columnX = widths.reduce<number[]>((positions, width) => {
    positions.push(positions.at(-1)! + width);
    return positions;
  }, [x]);
  const elements: SlideElement[] = [
    rect(x, startY, 1160, totalHeight, paper, ink),
    rect(x, startY, 1160, headerHeight, ink),
  ];
  labels.forEach((label, index) => {
    elements.push(text(label, columnX[index] + 8, startY + 8, widths[index] - 16, 11, 7, {
      bold: true,
      color: "#FFFFFF",
    }));
  });
  columnX.slice(1, -1).forEach((position) => {
    elements.push(line(position, startY, position, startY + totalHeight, rule));
  });
  document.parts.forEach((part, index) => {
    const rowY = startY + headerHeight + index * rowHeight;
    if (index > 0) elements.push(line(x, rowY, x + 1160, rowY, rule));
    elements.push(text(String(index + 1).padStart(2, "0"), x + 8, rowY + 7, widths[0] - 16, 10, 7, {
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
      rect(x, y, width, rowHeight, paper, rule),
      rect(x + 9, y + 10, 22, 22, part.colorHex, "#BFC1C8"),
      text(part.name, x + 40, y + 9, width - 48, 13, 7, { bold: true }),
      text(`${part.colorName} · ${part.colorHex}`, x + 40, y + 27, width - 48, 12, 6, { color: muted }),
    ];
  });
}

function layout(id: string, description: string, elements: SlideElement[]): TemplateV2Layout {
  return { id, description, background: paper, elements } as TemplateV2Layout;
}

function mainSpecificationPage(document: TechPackDocument, templateId: TechPackTemplateId, pageCount: number): TechPackEditorPage {
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
      ...documentHeader(document, 1, pageCount),
      text("UPPER SPECIFICATION", 32, 84, 260, 20, 11, { bold: true, color: violet }),
      text("REGION MAP + MATERIAL CALLOUTS", 815, 86, 377, 16, 8, { bold: true, color: muted, align: "right" }),
      line(32, 108, 1192, 108, ink, 2),
      image(primary.imageUrl ?? document.primarySource.imageUrl, primaryImageRect.x, primaryImageRect.y, primaryImageRect.width, primaryImageRect.height, "primary_lateral_view"),
      ...automaticCallouts(document.parts, primaryImageRect),
      text("LATERAL · SELECTED PRIMARY DESIGN", 188, 436, 572, 16, 7, { bold: true, color: muted, align: "center" }),
      ...(top?.imageUrl ? [image(top.imageUrl, 932, 124, 116, 142, "top_view")] : pendingView(932, 124, 116, 142, "Top")),
      ...(heel?.imageUrl ? [image(heel.imageUrl, 1062, 124, 130, 142, "heel_view")] : pendingView(1062, 124, 130, 142, "Heel")),
      rect(932, 280, 260, 144, violetSoft, "#C9C6FF"),
      text("DESIGN INTENT", 948, 296, 150, 14, 8, { bold: true, color: violet }),
      text(document.intent, 948, 320, 228, 88, 9, { name: "design_intent" }),
      text("COMPONENT SPECIFICATIONS", 32, 462, 470, 14, 8, { bold: true, color: violet }),
      ...componentTable(document, 482),
    ]),
  };
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
      text("GRAPHIC DETAILS", 42, 86, 520, 20, 12, { bold: true, color: violet }),
      text("SOLE UNIT DETAILS", 632, 86, 520, 20, 12, { bold: true, color: violet }),
      line(612, 86, 612, 746, ink, 2), line(42, 113, 582, 113, ink, 2), line(632, 113, 1182, 113, ink, 2),
      rect(42, 130, 540, 250, "#F7F7F9", rule),
      text("DROP A GRAPHIC OR CROSS-SECTION HERE", 74, 234, 476, 20, 11, { bold: true, color: muted, align: "center" }),
      ...(top?.imageUrl ? [image(top.imageUrl, 652, 130, 250, 250, "sole_top_view")] : pendingView(652, 130, 250, 250, "Outsole / top")),
      ...(heel?.imageUrl ? [image(heel.imageUrl, 922, 130, 240, 250, "heel_detail_view")] : pendingView(922, 130, 240, 250, "Heel")),
      text("CONSTRUCTION + REVIEW NOTES", 42, 416, 410, 18, 10, { bold: true, color: violet }),
      rect(42, 443, 540, 290, paper, rule),
      text(document.constructionNotes.map((note, index) => `${index + 1}. ${note}`).join("\n\n"), 62, 463, 500, 240, 10, { name: "construction_notes" }),
      text("COLOR SWATCHES", 632, 416, 250, 18, 10, { bold: true, color: violet }),
      ...colorSwatchTable(document, 443),
    ]),
  };
}

export function techPackToEditorPages(document: TechPackDocument, templateId: TechPackTemplateId = "upper-two-page"): TechPackEditorPage[] {
  const pageCount = templateId === "upper-two-page" ? 2 : 1;
  const pages = [mainSpecificationPage(document, templateId, pageCount)];
  if (templateId === "upper-two-page") pages.push(detailPage(document));
  return pages;
}

function sectionHeader(document: TechPackDocument, title: string): SlideElement[] {
  return [
    ...documentHeader(document, 1, 1),
    text(title.toUpperCase(), 32, 84, 620, 20, 11, { bold: true, color: violet }),
    line(32, 108, 1192, 108, ink, 2),
  ];
}

function regionMapSection(document: TechPackDocument): TemplateV2Layout {
  const primary = document.views.find((view) => view.label === "Primary") ?? document.views[0];
  const imageRect = { x: 224, y: 142, width: 776, height: 444 };
  return layout("tech-pack-section-region-map", "Live Vizcom Region Map callouts", [
    ...sectionHeader(document, "Region Map"),
    image(primary.imageUrl ?? document.primarySource.imageUrl, imageRect.x, imageRect.y, imageRect.width, imageRect.height, "region_map_primary"),
    ...automaticCallouts(document.parts, imageRect),
    text("LIVE VIZCOM REGIONS · EDIT NAMES, COLORS, MATERIALS, AND MASKS ON THE WORKBENCH", 224, 606, 776, 16, 7, { bold: true, color: muted, align: "center" }),
    rect(224, 644, 776, 78, violetSoft, "#C9C6FF"),
    text("DESIGN INTENT", 244, 660, 140, 14, 8, { bold: true, color: violet }),
    text(document.intent, 390, 658, 586, 44, 9, { name: "region_map_intent" }),
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
    rect(32, 134, 718, 590, paper, rule),
    text("ASSEMBLY + REVIEW", 54, 158, 670, 18, 9, { bold: true, color: violet }),
    text(document.constructionNotes.map((note, index) => `${String(index + 1).padStart(2, "0")}   ${note}`).join("\n\n"), 54, 198, 670, 470, 13, { name: "construction_notes_section" }),
    rect(782, 134, 410, 590, "#F7F7F9", rule),
    text("COMPONENT REFERENCE", 806, 158, 362, 18, 9, { bold: true, color: violet }),
    ...document.parts.flatMap((part, index) => {
      const y = 204 + index * Math.min(92, 448 / Math.max(1, document.parts.length));
      return [
        rect(806, y, 18, 18, part.colorHex, "#BFC1C8"),
        text(`${String(index + 1).padStart(2, "0")}  ${part.name}`, 836, y, 320, 15, 9, { bold: true }),
        text(`${part.material} · ${part.finish}`, 836, y + 22, 320, 28, 7, { color: muted }),
      ];
    }),
  ]);
}

function coverSection(document: TechPackDocument): TemplateV2Layout {
  const primary = document.views.find((view) => view.label === "Primary") ?? document.views[0];
  return layout("tech-pack-section-cover", "Tech Pack cover", [
    rect(0, 0, pageWidth, pageHeight, "#F7F7F9"),
    rect(0, 0, 304, pageHeight, ink),
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
    text("CUSTOM SECTION", 48, 44, 300, 20, 10, { bold: true, color: violet }),
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
