"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FilePlus2,
  GripVertical,
  MessageSquarePlus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { TemplateV2KonvaSlide } from "@/components/slide-editor/surface/TemplateV2KonvaSlide";
import {
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  type TemplateV2InsertElementsDetail,
} from "@/components/slide-editor/events/events";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import type { SlideElement } from "@/components/slide-editor/types";
import {
  TECH_PACK_PAGE_SIZE,
  TECH_PACK_SECTION_OPTIONS,
  TECH_PACK_TEMPLATES,
  createTechPackSectionPage,
  numberTechPackPages,
  techPackToEditorPages,
  type TechPackEditorPage,
  type TechPackSectionType,
  type TechPackTemplateId,
} from "./techPackAdapter";
import type { TechPackDocument } from "./techPackModel";

function newCalloutElements(index: number): SlideElement[] {
  const markerX = 690;
  const markerY = 248;
  const markerSize = 24;
  const cardX = 776;
  const cardY = markerY - 13;
  const cardWidth = 140;
  const cardHeight = 50;
  return [
    {
      type: "vector",
      shape: "ellipse",
      points: [
        { x: markerX, y: markerY }, { x: markerX + markerSize, y: markerY },
        { x: markerX + markerSize, y: markerY + markerSize }, { x: markerX, y: markerY + markerSize },
      ],
      closed: true,
      fill: { color: "#615CF6", opacity: 1 },
      stroke: { color: "#FCFCFD", opacity: 1, width: 1.5 },
    },
    {
      type: "text",
      position: { x: markerX, y: markerY + 5 },
      size: { width: markerSize, height: 14 },
      alignment: { horizontal: "center", vertical: "top" },
      runs: [{ text: String(index).padStart(2, "0") }],
      font: { family: "Inter", size: 7, color: "#FFFFFF", bold: true, line_height: 1 },
      decorative: false,
      name: `callout_${index}_number`,
    },
    {
      type: "vector",
      points: [
        { x: markerX + markerSize, y: markerY + markerSize / 2 },
        { x: cardX, y: markerY + markerSize / 2 },
      ],
      closed: false,
      stroke: { color: "#615CF6", opacity: 0.75, width: 1.25 },
    },
    {
      type: "vector",
      shape: "polygon",
      points: [
        { x: cardX, y: cardY },
        { x: cardX + cardWidth, y: cardY },
        { x: cardX + cardWidth, y: cardY + cardHeight },
        { x: cardX, y: cardY + cardHeight },
      ],
      closed: true,
      fill: { color: "#1B1C20", opacity: 1 },
      stroke: null,
    },
    {
      type: "vector",
      shape: "polygon",
      points: [
        { x: cardX, y: cardY },
        { x: cardX + 4, y: cardY },
        { x: cardX + 4, y: cardY + cardHeight },
        { x: cardX, y: cardY + cardHeight },
      ],
      closed: true,
      fill: { color: "#615CF6", opacity: 1 },
      stroke: null,
    },
    {
      type: "text",
      position: { x: cardX + 12, y: cardY + 8 },
      size: { width: cardWidth - 24, height: 36 },
      alignment: { horizontal: "left", vertical: "top" },
      runs: [{ text: "Describe the construction or manufacturing requirement" }],
      font: { family: "Inter", size: 7, color: "#FCFCFD", bold: true, line_height: 1.15 },
      decorative: false,
      name: `callout_${index}_note`,
    },
  ];
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
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const canvasContainerRef = useRef<HTMLElement | null>(null);
  const sourceDocumentRef = useRef(document);
  const sectionInstanceRef = useRef(0);
  const numberedPages = useMemo(() => numberTechPackPages(pages), [pages]);
  const activeIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));
  const activePage = numberedPages[activeIndex];
  const supportingImageCount = workingDocument.sourceSection?.assets.filter((asset) => asset.imageUrl).length ?? 0;
  const supportingItemCount = workingDocument.sourceSection?.assets.length ?? 0;

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
    window.localStorage.setItem("vizcom-tech-pack-spike-pages", JSON.stringify(numberedPages));
  }, [numberedPages]);

  useEffect(() => {
    if (sourceDocumentRef.current === document) return;
    sourceDocumentRef.current = document;
    const generatedPages = techPackToEditorPages(document, templateId);
    setWorkingDocument(document);
    setPages((current) => {
      const generatedById = new Map(generatedPages.map((page) => [page.id, page]));
      const next = current.flatMap((page) => {
        if (!page.sourceManaged) return [page];
        const generated = generatedById.get(page.id);
        return generated ? [generated] : [];
      });
      generatedPages.forEach((page) => {
        if (!next.some((candidate) => candidate.id === page.id)) next.push(page);
      });
      return next;
    });
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
    const generatedPages = techPackToEditorPages(workingDocument, nextTemplateId);
    const nextPages = [...generatedPages, ...pages.filter((page) => !page.sourceManaged)];
    setTemplateId(nextTemplateId);
    setPages(nextPages);
    setActivePageId(nextPages[0].id);
    setSavedAt("Created from Vizcom template · source links preserved");
  };

  const addPage = (sectionType: TechPackSectionType) => {
    sectionInstanceRef.current += 1;
    const page = createTechPackSectionPage(
      workingDocument,
      sectionType,
      `${Date.now()}-${sectionInstanceRef.current}`,
    );
    setPages((current) => [...current, page]);
    setActivePageId(page.id);
    setSectionPickerOpen(false);
    setSavedAt(`${page.title} page added · saved`);
  };

  const duplicatePage = (page: TechPackEditorPage) => {
    sectionInstanceRef.current += 1;
    const copy = structuredClone(page);
    copy.id = `custom-${page.sectionType}-${Date.now()}-${sectionInstanceRef.current}`;
    copy.title = `${page.title} copy`;
    copy.sourceManaged = false;
    const index = pages.findIndex((candidate) => candidate.id === page.id);
    setPages((current) => [
      ...current.slice(0, index + 1),
      copy,
      ...current.slice(index + 1),
    ]);
    setActivePageId(copy.id);
    setSavedAt(`${page.title} duplicated · saved`);
  };

  const deletePage = (pageId: string) => {
    if (pages.length === 1) return;
    const index = pages.findIndex((page) => page.id === pageId);
    const next = pages.filter((page) => page.id !== pageId);
    setPages(next);
    if (activePageId === pageId) setActivePageId(next[Math.min(index, next.length - 1)].id);
    setSavedAt("Page deleted · saved");
  };

  const startRename = (page: TechPackEditorPage) => {
    setRenamingPageId(page.id);
    setRenameDraft(page.title);
  };

  const saveRename = () => {
    const title = renameDraft.trim();
    if (!renamingPageId || !title) return;
    setPages((current) => current.map((page) => page.id === renamingPageId ? { ...page, title } : page));
    setRenamingPageId(null);
    setSavedAt("Page renamed · saved");
  };

  const reorderPage = (targetPageId: string) => {
    if (!draggedPageId || draggedPageId === targetPageId) return;
    setPages((current) => {
      const from = current.findIndex((page) => page.id === draggedPageId);
      const to = current.findIndex((page) => page.id === targetPageId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedPageId(null);
    setSavedAt("Pages reordered · saved");
  };

  const openPrintView = () => {
    window.localStorage.setItem("vizcom-tech-pack-spike-pages", JSON.stringify(numberedPages));
    window.open("/tech-pack-spike/print", "_blank", "noopener,noreferrer");
  };

  return (
    <main
      className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-[#111214] text-white"
      style={{ fontFamily: "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-[11px] font-semibold tracking-[0.16em] text-[#8D88FF]">VIZCOM DOCS</span>
          <div className="h-4 w-px bg-white/10" />
          <div>
            <h1 className="truncate text-[13px] font-medium">{workingDocument.title}</h1>
            <p className="truncate text-[10px] text-white/40">
              {workingDocument.sourceSection
                ? `${workingDocument.sourceSection.title} · ${workingDocument.sourceSection.assets.length + 1} linked workbench items`
                : "Tech Pack"} · {savedAt}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={viewMode === "static"} className="flex h-8 items-center gap-2 rounded-md border border-white/10 px-2.5 text-[11px] text-white/65 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35" type="button" onClick={addCallout}>
            <MessageSquarePlus className="h-4 w-4" /> Add callout
          </button>
          <div className="relative">
            <button
              disabled={viewMode === "static"}
              aria-expanded={sectionPickerOpen}
              className="flex h-8 items-center gap-2 rounded-md border border-white/10 px-2.5 text-[11px] text-white/65 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
              type="button"
              onClick={() => setSectionPickerOpen((open) => !open)}
            >
              <FilePlus2 className="h-4 w-4" /> Add page
            </button>
            {sectionPickerOpen && viewMode === "document" && (
              <div className="absolute right-0 top-11 z-50 w-[430px] rounded-2xl border border-white/10 bg-[#202126] p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <p className="text-xs font-semibold text-white">Add a document page</p>
                    <p className="mt-0.5 text-[10px] text-white/40">Uses the current Vizcom design data where available</p>
                  </div>
                  <button aria-label="Close page picker" type="button" onClick={() => setSectionPickerOpen(false)} className="rounded-md p-1 text-white/45 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {TECH_PACK_SECTION_OPTIONS.map((option) => (
                    <button key={option.id} type="button" onClick={() => addPage(option.id)} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-left hover:border-[#6962FF] hover:bg-[#6962FF]/10">
                      <span className="block text-xs font-semibold text-white/90">{option.label}</span>
                      <span className="mt-1 block text-[10px] leading-4 text-white/40">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="flex h-8 items-center gap-2 rounded-md bg-[#5B55F7] px-3 text-[11px] font-medium hover:bg-[#6B65FF]" type="button" onClick={openPrintView}>
            <Download className="h-4 w-4" /> Print / PDF
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="block w-60 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#17181B] p-3">
          <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-white/75">Vizcom source</span>
              <span className="flex items-center gap-1 text-[9px] text-[#9D98FF]"><span className="h-1.5 w-1.5 rounded-full bg-[#6962FF]" />Live</span>
            </div>
            <p className="mt-1.5 truncate text-[11px] text-white/85">
              {workingDocument.sourceSection?.title ?? workingDocument.title}
            </p>
            <p className="mt-1 text-[9px] text-white/40">1 Region Map · {supportingImageCount} images · {supportingItemCount} linked items</p>
          </div>
          <label className="mb-3 flex h-8 items-center justify-between rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[10px] text-white/40">
            <span>Template</span>
            <select
              aria-label="Create from template"
              value={templateId}
              disabled={viewMode === "static"}
              onChange={(event) => chooseTemplate(event.target.value as TechPackTemplateId)}
              className="max-w-[130px] bg-transparent text-right text-[10px] font-medium text-white/70 outline-none"
            >
              {TECH_PACK_TEMPLATES.map((template) => <option key={template.id} value={template.id} className="bg-[#202126]">{template.label}</option>)}
            </select>
          </label>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Pages</span>
            <span className="text-[11px] text-white/30">{pages.length}</span>
          </div>
          <div className="space-y-2">
            {numberedPages.map((page, index) => (
              <article
                key={page.id}
                draggable={viewMode === "document" && renamingPageId !== page.id}
                onDragStart={() => setDraggedPageId(page.id)}
                onDragEnd={() => setDraggedPageId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorderPage(page.id)}
                className={`w-full rounded-lg border p-2 text-left transition ${page.id === activePage.id ? "border-[#6962FF] bg-[#222228]" : "border-white/[0.07] bg-transparent hover:border-white/15"} ${draggedPageId === page.id ? "opacity-45" : ""}`}
              >
                <button type="button" onClick={() => setActivePageId(page.id)} className="block w-full text-left">
                  <div className="overflow-hidden rounded-md bg-white" style={{ aspectRatio: `${TECH_PACK_PAGE_SIZE.width}/${TECH_PACK_PAGE_SIZE.height}` }}>
                    <div className="origin-top-left" style={{ width: TECH_PACK_PAGE_SIZE.width, height: TECH_PACK_PAGE_SIZE.height, transform: "scale(0.17)" }}>
                      <TemplateV2KonvaSlide layout={page.layout} isEditMode={false} slideId={page.id} slideIndex={index} renderIndex={index} displayScale={0.17} />
                    </div>
                  </div>
                </button>
                <div className="mt-2 flex min-w-0 items-center gap-1 text-xs">
                  {viewMode === "document" && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-white/25" />}
                  <span className="shrink-0 text-white/35">{String(index + 1).padStart(2, "0")}</span>
                  {renamingPageId === page.id ? (
                    <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(event) => { event.preventDefault(); saveRename(); }}>
                      <input autoFocus aria-label="Page name" value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} className="min-w-0 flex-1 rounded border border-[#6962FF] bg-black/20 px-1.5 py-1 text-[11px] text-white outline-none" />
                      <button aria-label="Save page name" title="Save name" type="submit" className="rounded p-1 text-[#8D88FF] hover:bg-white/5"><Check className="h-3.5 w-3.5" /></button>
                      <button aria-label="Cancel rename" title="Cancel rename" type="button" onClick={() => setRenamingPageId(null)} className="rounded p-1 text-white/40 hover:bg-white/5"><X className="h-3.5 w-3.5" /></button>
                    </form>
                  ) : (
                    <>
                      <button type="button" onClick={() => setActivePageId(page.id)} className="min-w-0 flex-1 truncate text-left text-white/75">{page.title}</button>
                      {viewMode === "document" && (
                        <div className="flex shrink-0 items-center">
                          <button aria-label={`Rename ${page.title}`} title="Rename" type="button" onClick={() => startRename(page)} className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                          <button aria-label={`Duplicate ${page.title}`} title="Duplicate" type="button" onClick={() => duplicatePage(page)} className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
                          <button aria-label={`Delete ${page.title}`} title="Delete" disabled={pages.length === 1} type="button" onClick={() => deletePage(page.id)} className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-red-300 disabled:opacity-20"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section ref={canvasContainerRef} className="relative block min-w-0 flex-1 overflow-auto bg-[#202125]">
          <div className="sticky top-0 z-20 flex h-10 items-center justify-center border-b border-white/[0.07] bg-[#18191C]/95 text-[10px] text-white/45 backdrop-blur">
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
            <span className="absolute right-4">{Math.round(displayScale * 100)}%</span>
          </div>
          <div className="flex min-h-[calc(100%-40px)] items-start justify-center p-7">
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
