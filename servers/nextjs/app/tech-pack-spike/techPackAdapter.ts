import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import type { SlideElement } from "@/components/slide-editor/types";
import type { TechPackDocument, TechPackPart } from "./techPackModel";

export type TechPackTemplateId = "upper-one-page" | "upper-three-row" | "upper-two-page";

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
      const span = 256;
      const labelY = sorted.length === 1 ? 312 : 184 + (span * index) / (sorted.length - 1);
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

function metadataHeader(document: TechPackDocument, page: number, pageCount: number): SlideElement[] {
  const fields = [
    ["PRODUCT", document.title], ["ITEM", document.styleNumber], ["INTRO", document.header.introDate],
    ["DATE", document.header.currentDate], ["ITEM CODE", document.header.itemCode], ["GBU", document.header.businessUnit],
    ["PROTO", document.header.protoRound], ["SEQUENCE", document.header.sequenceId], ["FACTORY", document.header.developmentFactory],
    ["DESIGNER", document.header.designer], ["DEVELOPER", document.header.developer], ["TYPE", document.header.projectType],
    ["REFERENCE", document.header.referenceNumber], ["PAGE", `${page} OF ${pageCount}`],
  ];
  const logoWidth = 92;
  const fieldWidth = (pageWidth - 64 - logoWidth) / fields.length;
  const elements: SlideElement[] = [
    rect(32, 24, pageWidth - 64, 56, paper, ink), rect(32, 24, logoWidth, 56, ink),
    text("VIZCOM", 42, 35, logoWidth - 20, 18, 14, { bold: true, color: "#FFFFFF" }),
    text("TECH PACK", 42, 55, logoWidth - 20, 12, 7, { bold: true, color: "#AAA7FF" }),
  ];
  fields.forEach(([label, value], index) => {
    const x = 32 + logoWidth + index * fieldWidth;
    elements.push(line(x, 24, x, 80, rule));
    elements.push(text(label, x + 4, 31, fieldWidth - 8, 10, 6, { bold: true, color: muted }));
    elements.push(text(value, x + 4, 48, fieldWidth - 8, 24, 7, { bold: true }));
  });
  return elements;
}

function partCard(part: TechPackPart, index: number, x: number, y: number, width: number, height: number): SlideElement[] {
  return [
    rect(x, y, width, height, paper, rule), rect(x, y, width, 25, index % 2 === 0 ? ink : "#2A2B31"),
    text(`${String(index + 1).padStart(2, "0")}  ${part.name.toUpperCase()}`, x + 9, y + 7, width - 18, 12, 8, { bold: true, color: "#FFFFFF", name: `part_${part.id}_name` }),
    rect(x + 10, y + 37, 20, 20, part.colorHex, "#BFC1C8"),
    text(`${part.colorName.toUpperCase()}  ${part.colorHex}`, x + 38, y + 37, width - 48, 20, 8, { bold: true }),
    text(part.material, x + 10, y + 67, width - 20, 20, 8, { bold: true, color: violet }),
    text(`VENDOR  ${part.supplier}  ·  VII  ${part.vendorItemIdentifier}`, x + 10, y + 94, width - 20, 16, 7, { color: muted }),
    text(`MATERIAL  ${part.vendorMaterialName}`, x + 10, y + 113, width - 20, 16, 7),
    text(`FINISH  ${part.finish}  ·  MPN  ${part.materialPartNumber}`, x + 10, y + 132, width - 20, 16, 7, { color: muted }),
    text(`REGION  ${part.regionLayerId}`, x + 10, y + height - 20, width - 20, 12, 6, { color: violet }),
  ];
}

function componentGrid(document: TechPackDocument, startY: number, rows: 1 | 3): SlideElement[] {
  const columns = rows === 3 ? 6 : 4;
  const gap = 8;
  const width = (1160 - gap * (columns - 1)) / columns;
  const availableHeight = pageHeight - startY - 30;
  const height = rows === 3 ? Math.min(130, (availableHeight - gap * 2) / 3) : availableHeight;
  return document.parts.flatMap((part, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return partCard(part, index, 32 + column * (width + gap), startY + row * (height + gap), width, height);
  });
}

function layout(id: string, description: string, elements: SlideElement[]): TemplateV2Layout {
  return { id, description, background: paper, elements } as TemplateV2Layout;
}

function mainSpecificationPage(document: TechPackDocument, templateId: TechPackTemplateId, pageCount: number): TechPackEditorPage {
  const primary = document.views.find((view) => view.label === "Primary") ?? document.views[0];
  const top = document.views.find((view) => view.label === "Top");
  const heel = document.views.find((view) => view.label === "Heel");
  const threeRows = templateId === "upper-three-row";
  const gridY = threeRows ? 520 : 604;
  const primaryImageRect = { x: 188, y: 142, width: 572, height: threeRows ? 330 : 408 };
  return {
    id: "upper-specification",
    title: "Upper specification",
    layout: layout("tech-pack-upper-specification", "Region Map-backed upper specification", [
      ...metadataHeader(document, 1, pageCount),
      text("UPPER SPECIFICATION", 32, 95, 260, 20, 11, { bold: true, color: violet }),
      text("REGION MAP NOMENCLATURE + MATERIAL CALLOUTS", 815, 97, 377, 16, 8, { bold: true, color: muted, align: "right" }),
      line(32, 120, 1192, 120, ink, 2),
      image(primary.imageUrl ?? document.primarySource.imageUrl, primaryImageRect.x, primaryImageRect.y, primaryImageRect.width, primaryImageRect.height, "primary_lateral_view"),
      ...automaticCallouts(document.parts, primaryImageRect),
      text("LATERAL · SELECTED PRIMARY DESIGN · ALPHA-ANCHORED REGION CALLOUTS", 188, threeRows ? 480 : 558, 572, 16, 7, { bold: true, color: muted, align: "center" }),
      ...(top?.imageUrl ? [image(top.imageUrl, 932, 142, 116, 158, "top_view")] : pendingView(932, 142, 116, 158, "Top")),
      ...(heel?.imageUrl ? [image(heel.imageUrl, 1062, 142, 130, 158, "heel_view")] : pendingView(1062, 142, 130, 158, "Heel")),
      rect(932, 318, 260, threeRows ? 154 : 232, violetSoft, "#C9C6FF"),
      text("DESIGN INTENT", 948, 334, 150, 14, 8, { bold: true, color: violet }),
      text(document.intent, 948, 358, 228, threeRows ? 78 : 104, 9, { name: "design_intent" }),
      text("SOURCE PROVENANCE", 948, threeRows ? 444 : 474, 160, 14, 7, { bold: true, color: violet }),
      text(`${document.primarySource.workbenchId}\n${document.primarySource.assetId}`, 948, threeRows ? 462 : 496, 228, 40, 7, { color: muted, name: "source_provenance" }),
      text(threeRows ? "COMPONENT SPECIFICATIONS · 3 ROW CAPACITY" : "COMPONENT SPECIFICATIONS · REGION MAP LINKED", 32, gridY - 23, 470, 14, 8, { bold: true, color: violet }),
      ...componentGrid(document, gridY, threeRows ? 3 : 1),
    ]),
  };
}

function detailPage(document: TechPackDocument): TechPackEditorPage {
  const top = document.views.find((view) => view.label === "Top");
  const heel = document.views.find((view) => view.label === "Heel");
  return {
    id: "graphic-sole-details",
    title: "Graphic & sole details",
    layout: layout("tech-pack-graphic-sole-details", "Optional graphic, cross-section, and sole detail page", [
      ...metadataHeader(document, 2, 2),
      text("GRAPHIC DETAILS", 42, 104, 520, 20, 12, { bold: true, color: violet }),
      text("SOLE UNIT DETAILS", 632, 104, 520, 20, 12, { bold: true, color: violet }),
      line(612, 104, 612, 746, ink, 2), line(42, 134, 582, 134, ink, 2), line(632, 134, 1182, 134, ink, 2),
      rect(42, 154, 540, 296, "#F7F7F9", rule),
      text("DROP REGION MAP GRAPHIC OR CROSS-SECTION HERE", 74, 276, 476, 20, 11, { bold: true, color: muted, align: "center" }),
      text("Add sections by dragging selected workbench outputs into this page.", 74, 308, 476, 40, 9, { color: muted, align: "center" }),
      ...(top?.imageUrl ? [image(top.imageUrl, 652, 154, 250, 296, "sole_top_view")] : pendingView(652, 154, 250, 296, "Outsole / top")),
      ...(heel?.imageUrl ? [image(heel.imageUrl, 922, 154, 240, 296, "heel_detail_view")] : pendingView(922, 154, 240, 296, "Heel")),
      text("CONSTRUCTION + REVIEW NOTES", 42, 486, 410, 18, 10, { bold: true, color: violet }),
      rect(42, 514, 540, 218, paper, rule),
      text(document.constructionNotes.map((note, index) => `${index + 1}. ${note}`).join("\n\n"), 62, 534, 500, 170, 10, { name: "construction_notes" }),
      text("COLOR SWATCHES", 632, 486, 250, 18, 10, { bold: true, color: violet }),
      ...document.parts.flatMap((part, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 632 + column * 275;
        const y = 514 + row * 104;
        return [
          rect(x, y, 255, 88, paper, rule), rect(x + 12, y + 14, 28, 28, part.colorHex, "#BFC1C8"),
          text(part.name.toUpperCase(), x + 52, y + 13, 188, 14, 8, { bold: true }),
          text(`${part.colorName} · ${part.colorHex}`, x + 52, y + 34, 188, 14, 7, { color: muted }),
          text(part.materialPartNumber, x + 52, y + 56, 188, 14, 7, { color: violet }),
        ];
      }),
    ]),
  };
}

export function techPackToEditorPages(document: TechPackDocument, templateId: TechPackTemplateId = "upper-two-page"): TechPackEditorPage[] {
  const pageCount = templateId === "upper-two-page" ? 2 : 1;
  const pages = [mainSpecificationPage(document, templateId, pageCount)];
  if (templateId === "upper-two-page") pages.push(detailPage(document));
  return pages;
}

export const TECH_PACK_PAGE_SIZE = { width: pageWidth, height: pageHeight } as const;
