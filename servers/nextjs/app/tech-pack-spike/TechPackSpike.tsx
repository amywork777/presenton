"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FilePlus2, MessageSquarePlus } from "lucide-react";
import { TemplateV2KonvaSlide } from "@/components/slide-editor/surface/TemplateV2KonvaSlide";
import {
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  type TemplateV2InsertElementsDetail,
} from "@/components/slide-editor/events/events";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import type { SlideElement } from "@/components/slide-editor/types";
import {
  TECH_PACK_PAGE_SIZE,
  TECH_PACK_TEMPLATES,
  techPackToEditorPages,
  type TechPackEditorPage,
  type TechPackTemplateId,
} from "./techPackAdapter";
import type { TechPackDocument } from "./techPackModel";

function newCalloutElements(index: number): SlideElement[] {
  const markerX = 520;
  const markerY = 236;
  return [
    {
      type: "vector",
      shape: "ellipse",
      points: [
        { x: markerX, y: markerY }, { x: markerX + 32, y: markerY },
        { x: markerX + 32, y: markerY + 32 }, { x: markerX, y: markerY + 32 },
      ],
      closed: true,
      fill: { color: "#5B55F7", opacity: 1 },
      stroke: { color: "#FFFFFF", opacity: 1, width: 2 },
    },
    {
      type: "text",
      position: { x: markerX, y: markerY + 5 },
      size: { width: 32, height: 22 },
      alignment: { horizontal: "center", vertical: "top" },
      runs: [{ text: String(index) }],
      font: { family: "Arial", size: 13, color: "#FFFFFF", bold: true, line_height: 1 },
      decorative: false,
      name: `callout_${index}_number`,
    },
    {
      type: "vector",
      points: [{ x: markerX + 32, y: markerY + 16 }, { x: markerX + 116, y: markerY + 16 }],
      closed: false,
      stroke: { color: "#5B55F7", opacity: 1, width: 2 },
    },
    {
      type: "text",
      position: { x: markerX + 126, y: markerY - 1 },
      size: { width: 260, height: 54 },
      alignment: { horizontal: "left", vertical: "top" },
      runs: [{ text: "Describe the construction or manufacturing requirement" }],
      font: { family: "Arial", size: 12, color: "#17181C", bold: true, line_height: 1.15 },
      decorative: false,
      name: `callout_${index}_note`,
    },
  ];
}

function blankPage(index: number): TechPackEditorPage {
  return {
    id: `custom-${Date.now()}`,
    title: `Custom section ${index}`,
    layout: {
      id: `custom-section-${index}`,
      description: "User-created Tech Pack section",
      background: "#FFFFFF",
      elements: [],
    } as TemplateV2Layout,
  };
}

export function TechPackSpike({ document }: { document: TechPackDocument }) {
  const [workingDocument, setWorkingDocument] = useState(document);
  const [templateId, setTemplateId] = useState<TechPackTemplateId>("upper-two-page");
  const initialPages = useMemo(() => techPackToEditorPages(document, "upper-two-page"), [document]);
  const [pages, setPages] = useState(initialPages);
  const [activePageId, setActivePageId] = useState(initialPages[0].id);
  const [savedAt, setSavedAt] = useState("Saved from Vizcom data");
  const [displayScale, setDisplayScale] = useState(0.62);
  const [calloutCount, setCalloutCount] = useState(document.parts.length);
  const [viewMode, setViewMode] = useState<"document" | "static">("document");
  const canvasContainerRef = useRef<HTMLElement | null>(null);
  const sourceDocumentRef = useRef(document);
  const activeIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));
  const activePage = pages[activeIndex];

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const updateScale = () => {
      const availableWidth = Math.max(320, container.clientWidth - 80);
      setDisplayScale(Math.max(0.25, Math.min(0.74, availableWidth / TECH_PACK_PAGE_SIZE.width)));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (sourceDocumentRef.current === document) return;
    sourceDocumentRef.current = document;
    const generatedPages = techPackToEditorPages(document, templateId);
    setWorkingDocument(document);
    setPages((current) => [
      ...generatedPages,
      ...current.filter((page) => page.id.startsWith("custom-")),
    ]);
    setActivePageId((current) =>
      generatedPages.some((page) => page.id === current)
        ? current
        : generatedPages[0].id,
    );
    setSavedAt("Live Vizcom Regions synced · document updated");
  }, [document, templateId]);

  const updateActiveLayout = (layout: TemplateV2Layout) => {
    setPages((current) =>
      current.map((page) => (page.id === activePage.id ? { ...page, layout } : page)),
    );
    setSavedAt("Edited locally · source links preserved");
  };

  const addCallout = () => {
    if (viewMode === "static") return;
    const nextCallout = calloutCount + 1;
    const detail: TemplateV2InsertElementsDetail = {
      elements: newCalloutElements(nextCallout),
      label: "Tech Pack callout",
      slideIndex: activeIndex,
    };
    window.dispatchEvent(new CustomEvent(TEMPLATE_V2_INSERT_ELEMENTS_EVENT, { detail }));
    setCalloutCount(nextCallout);
  };

  const chooseTemplate = (nextTemplateId: TechPackTemplateId) => {
    if (viewMode === "static") return;
    const nextPages = techPackToEditorPages(workingDocument, nextTemplateId);
    setTemplateId(nextTemplateId);
    setPages(nextPages);
    setActivePageId(nextPages[0].id);
    setSavedAt("Created from Vizcom template · source links preserved");
  };

  const addPage = () => {
    const page = blankPage(pages.length + 1);
    setPages((current) => [...current, page]);
    setActivePageId(page.id);
    setSavedAt("New custom section · unsaved");
  };

  const openPrintView = () => {
    window.localStorage.setItem("vizcom-tech-pack-spike-pages", JSON.stringify(pages));
    window.open("/tech-pack-spike/print", "_blank", "noopener,noreferrer");
  };

  return (
    <main className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-[#111216] text-white">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold tracking-[0.18em] text-[#8D88FF]">VIZCOM</span>
          <div className="h-5 w-px bg-white/15" />
          <div>
            <h1 className="text-sm font-semibold">{workingDocument.title}</h1>
            <p className="text-[11px] text-white/45">Tech Pack · {savedAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/65">
            <span className="text-white/35">Create from template</span>
            <select
              aria-label="Create from template"
              value={templateId}
              disabled={viewMode === "static"}
              onChange={(event) => chooseTemplate(event.target.value as TechPackTemplateId)}
              className="bg-transparent font-semibold text-white outline-none"
            >
              {TECH_PACK_TEMPLATES.map((template) => <option key={template.id} value={template.id} className="bg-[#202126]">{template.label}</option>)}
            </select>
          </label>
          <button disabled={viewMode === "static"} className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/70 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35" type="button" onClick={addCallout}>
            <MessageSquarePlus className="h-4 w-4" /> Add callout
          </button>
          <button disabled={viewMode === "static"} className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/70 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35" type="button" onClick={addPage}>
            <FilePlus2 className="h-4 w-4" /> Add section
          </button>
          <button className="flex h-9 items-center gap-2 rounded-lg bg-[#5B55F7] px-3 text-xs font-semibold hover:bg-[#6B65FF]" type="button" onClick={openPrintView}>
            <Download className="h-4 w-4" /> Print / PDF
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="block w-64 shrink-0 overflow-y-auto border-r border-white/10 bg-[#17181D] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Sections</span>
            <span className="text-[11px] text-white/30">{pages.length}</span>
          </div>
          <div className="space-y-3">
            {pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePageId(page.id)}
                className={`w-full rounded-xl border p-2 text-left transition ${page.id === activePage.id ? "border-[#6962FF] bg-[#25252D]" : "border-white/8 bg-[#1D1E23] hover:border-white/20"}`}
              >
                <div className="overflow-hidden rounded-md bg-white" style={{ aspectRatio: `${TECH_PACK_PAGE_SIZE.width}/${TECH_PACK_PAGE_SIZE.height}` }}>
                  <div className="origin-top-left" style={{ width: TECH_PACK_PAGE_SIZE.width, height: TECH_PACK_PAGE_SIZE.height, transform: "scale(0.17)" }}>
                    <TemplateV2KonvaSlide layout={page.layout} isEditMode={false} slideId={page.id} slideIndex={index} renderIndex={index} displayScale={0.17} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-white/35">{String(index + 1).padStart(2, "0")}</span>
                  <span className="truncate text-white/75">{page.title}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section ref={canvasContainerRef} className="relative block min-w-0 flex-1 overflow-auto bg-[#202126]">
          <div className="sticky top-0 z-20 flex h-11 items-center justify-center gap-3 border-b border-white/10 bg-[#18191D]/95 text-xs text-white/50 backdrop-blur">
            <span>17 × 11 in landscape</span>
            <span>·</span>
            <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
              <button
                type="button"
                aria-pressed={viewMode === "document"}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setViewMode("document");
                }}
                className={`rounded px-2 py-1 ${viewMode === "document" ? "bg-white/10 text-white" : "text-white/40"}`}
              >
                Annotate
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "static"}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setViewMode("static");
                }}
                className={`rounded px-2 py-1 ${viewMode === "static" ? "bg-white/10 text-white" : "text-white/40"}`}
              >
                Static preview
              </button>
            </div>
            <span>·</span>
            <span>{Math.round(displayScale * 100)}%</span>
          </div>
          <div className="flex min-h-[calc(100%-44px)] items-start justify-center p-10">
            <div
              className="relative shrink-0 overflow-visible bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
              style={{ width: TECH_PACK_PAGE_SIZE.width * displayScale, height: TECH_PACK_PAGE_SIZE.height * displayScale }}
            >
              <div className="relative origin-top-left" style={{ width: TECH_PACK_PAGE_SIZE.width, height: TECH_PACK_PAGE_SIZE.height, transform: `scale(${displayScale})` }}>
                <TemplateV2KonvaSlide
                  key={`${activePage.id}-${viewMode}`}
                  layout={activePage.layout}
                  isEditMode={viewMode === "document"}
                  slideId={activePage.id}
                  slideIndex={activeIndex}
                  renderIndex={activeIndex}
                  displayScale={displayScale}
                  isSelected
                  onLayoutChange={updateActiveLayout}
                />
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
