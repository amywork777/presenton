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
import { RegionMapInteractive } from "./RegionMapInteractive";
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
  const [viewMode, setViewMode] = useState<"regions" | "document" | "static">("regions");
  const [sidebarTab, setSidebarTab] = useState<"regions" | "document">("regions");
  const [selectedPartId, setSelectedPartId] = useState(document.parts[0]?.id ?? "");
  const canvasContainerRef = useRef<HTMLElement | null>(null);
  const activeIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));
  const activePage = pages[activeIndex];
  const selectedPart = workingDocument.parts.find((part) => part.id === selectedPartId) ?? workingDocument.parts[0];
  const verifiedViewCount = workingDocument.views.filter((view) => view.verified).length;
  const pendingViewCount = workingDocument.views.length - verifiedViewCount;

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

  const replaceRegionDocument = (nextDocument: TechPackDocument, message: string) => {
    const generatedPages = techPackToEditorPages(nextDocument, templateId);
    const customPages = pages.filter((page) => page.id.startsWith("custom-"));
    const nextPages = [...generatedPages, ...customPages];
    setWorkingDocument(nextDocument);
    setPages(nextPages);
    if (!nextPages.some((page) => page.id === activePageId)) setActivePageId(nextPages[0].id);
    setSavedAt(message);
  };

  const updateRegionParts = (partIds: string[], patch: Partial<TechPackDocument["parts"][number]>) => {
    if (viewMode === "static") return;
    const selectedIds = new Set(partIds);
    const nextDocument = {
      ...workingDocument,
      parts: workingDocument.parts.map((part) => (selectedIds.has(part.id) ? { ...part, ...patch } : part)),
    };
    replaceRegionDocument(nextDocument, "Region Map updated · bound callouts refreshed");
  };

  const updateRegionPart = (partId: string, patch: Partial<TechPackDocument["parts"][number]>) =>
    updateRegionParts([partId], patch);

  const applyRegionPalette = (colors: string[]) => {
    const nextDocument = {
      ...workingDocument,
      parts: workingDocument.parts.map((part, index) => ({ ...part, colorHex: colors[index % colors.length] })),
    };
    replaceRegionDocument(nextDocument, "Palette applied · document updated");
  };

  const resetRegions = () => {
    setSelectedPartId(document.parts[0]?.id ?? "");
    replaceRegionDocument(document, "Region Map reset to source");
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
        {viewMode === "regions" ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">Region Map edits sync to the Tech Pack</span>
            <button type="button" onClick={() => { setViewMode("document"); setSidebarTab("document"); }} className="flex h-9 items-center gap-2 rounded-lg bg-[#5B55F7] px-4 text-xs font-semibold hover:bg-[#6B65FF]">
              <Download className="h-4 w-4" /> View Tech Pack
            </button>
          </div>
        ) : (
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
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {viewMode === "regions" ? (
          <RegionMapInteractive
            document={workingDocument}
            selectedPartId={selectedPartId}
            onSelectPart={setSelectedPartId}
            onUpdateParts={updateRegionParts}
            onApplyPalette={applyRegionPalette}
            onReset={resetRegions}
            onViewDocument={() => { setViewMode("document"); setSidebarTab("document"); }}
          />
        ) : null}

        <aside className={`${viewMode === "regions" ? "hidden" : "block"} w-64 shrink-0 overflow-y-auto border-r border-white/10 bg-[#17181D] p-4`}>
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

        <section ref={canvasContainerRef} className={`${viewMode === "regions" ? "hidden" : "block"} relative min-w-0 flex-1 overflow-auto bg-[#202126]`}>
          <div className="sticky top-0 z-20 flex h-11 items-center justify-center gap-3 border-b border-white/10 bg-[#18191D]/95 text-xs text-white/50 backdrop-blur">
            <span>17 × 11 in landscape</span>
            <span>·</span>
            <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
              <button
                type="button"
                aria-pressed={viewMode === "regions"}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setViewMode("regions");
                }}
                className={`rounded px-2 py-1 ${viewMode === "regions" ? "bg-white/10 text-white" : "text-white/40"}`}
              >
                Region Map
              </button>
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
                {viewMode === "document" && activePage.id === "upper-specification" && selectedPart ? (
                  <div
                    data-testid="selected-region-overlay"
                    className="pointer-events-none absolute z-50 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[#5B55F7] bg-[#5B55F7]/20 shadow-[0_0_0_8px_rgba(91,85,247,0.12)]"
                    style={{
                      left: 188 + selectedPart.anchor.x * 572,
                      top: 142 + selectedPart.anchor.y * (templateId === "upper-three-row" ? 330 : 408),
                    }}
                  >
                    <span className="rounded bg-[#5B55F7] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {String(workingDocument.parts.findIndex((part) => part.id === selectedPart.id) + 1).padStart(2, "0")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <aside className={`${viewMode === "regions" ? "hidden" : "block"} w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#17181D] p-4`}>
          <div className="mb-4 grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1 text-xs">
            <button type="button" onClick={() => setSidebarTab("regions")} className={`rounded-md px-3 py-2 ${sidebarTab === "regions" ? "bg-[#5B55F7] text-white" : "text-white/45"}`}>Region Map</button>
            <button type="button" onClick={() => setSidebarTab("document")} className={`rounded-md px-3 py-2 ${sidebarTab === "document" ? "bg-white/10 text-white" : "text-white/45"}`}>Document</button>
          </div>

          {sidebarTab === "regions" ? (
            <div>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A7A3FF]">Region Map source</p>
                  <p className="mt-1 text-xs text-white/45">Select a part to edit every bound callout and spec.</p>
                </div>
                <span className="text-[11px] text-emerald-300">{workingDocument.parts.length} linked</span>
              </div>
              <div className="space-y-2">
                {workingDocument.parts.map((part, index) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setSelectedPartId(part.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left ${selectedPart?.id === part.id ? "border-[#6962FF] bg-[#6962FF]/10" : "border-white/8 bg-white/[0.02] hover:border-white/20"}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 text-[10px] font-bold" style={{ backgroundColor: part.colorHex, color: part.colorHex.toUpperCase() === "#171717" || part.colorHex.toUpperCase() === "#3C3C3A" ? "white" : "#17181C" }}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-white/85">{part.name}</span>
                      <span className="block truncate text-[10px] text-white/40">{part.material}</span>
                    </span>
                    <span className="text-[10px] text-white/25">{part.regionLayerId}</span>
                  </button>
                ))}
              </div>

              {selectedPart ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-semibold text-white/80">Part properties</p>
                    <span className="text-[10px] text-[#A7A3FF]">Anchor {Math.round(selectedPart.anchor.x * 100)}%, {Math.round(selectedPart.anchor.y * 100)}%</span>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">
                      Part name
                      <input aria-label="Region part name" disabled={viewMode === "static"} value={selectedPart.name} onChange={(event) => updateRegionPart(selectedPart.id, { name: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF] disabled:opacity-50" />
                    </label>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">
                      Material
                      <input aria-label="Region material" disabled={viewMode === "static"} value={selectedPart.material} onChange={(event) => updateRegionPart(selectedPart.id, { material: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF] disabled:opacity-50" />
                    </label>
                    <div className="grid grid-cols-[44px_1fr] gap-2">
                      <input aria-label="Region color picker" type="color" disabled={viewMode === "static"} value={selectedPart.colorHex} onChange={(event) => updateRegionPart(selectedPart.id, { colorHex: event.target.value.toUpperCase() })} className="mt-[18px] h-9 w-11 rounded-md border border-white/10 bg-black/20 p-1 disabled:opacity-50" />
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">
                        Color name
                        <input aria-label="Region color name" disabled={viewMode === "static"} value={selectedPart.colorName} onChange={(event) => updateRegionPart(selectedPart.id, { colorName: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF] disabled:opacity-50" />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">
                        Finish
                        <input aria-label="Region finish" disabled={viewMode === "static"} value={selectedPart.finish} onChange={(event) => updateRegionPart(selectedPart.id, { finish: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF] disabled:opacity-50" />
                      </label>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">
                        MPN
                        <input aria-label="Region MPN" disabled={viewMode === "static"} value={selectedPart.materialPartNumber} onChange={(event) => updateRegionPart(selectedPart.id, { materialPartNumber: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF] disabled:opacity-50" />
                      </label>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-white/30">Bound to {selectedPart.regionLayerId}. Changes refresh the numbered callout, component cell, and static export.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Document intent</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{workingDocument.intent}</p>
              </div>
              <div className="rounded-xl border border-[#6962FF]/30 bg-[#6962FF]/10 p-4">
                <p className="text-xs font-semibold text-[#A7A3FF]">Linked Vizcom source</p>
                <p className="mt-2 break-all text-[11px] leading-5 text-white/55">{workingDocument.primarySource.assetId}</p>
                <p className="mt-2 text-[11px] text-emerald-300">{verifiedViewCount} view verified · {workingDocument.parts.length} Region Map parts linked</p>
                {pendingViewCount > 0 ? <p className="mt-1 text-[11px] text-amber-300">{pendingViewCount} New Views pending</p> : null}
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-white/75">{viewMode === "document" ? "Annotate document" : "Static preview"}</p>
                <p className="mt-2 text-[11px] leading-5 text-white/45">{viewMode === "document" ? "Region Map changes flow into bound callouts and component specifications. Page-level annotations remain directly editable." : "Editing is locked. This is the same resolved layout used by PDF and PNG export."}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
