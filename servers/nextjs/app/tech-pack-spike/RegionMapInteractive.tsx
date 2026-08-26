"use client";

import { ArrowLeft, ChevronRight, FileText, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { TechPackDocument, TechPackPart } from "./techPackModel";

const REGION_PATHS: Record<string, string> = {
  "part-upper": "M88 414 C92 268 137 149 249 130 C355 84 487 91 610 126 C728 164 786 221 895 244 C1034 267 1150 265 1195 329 C1216 367 1184 420 1120 449 C958 489 782 492 638 474 C514 458 402 444 286 452 C188 458 121 450 88 414 Z",
  "part-cage": "M287 316 C380 281 492 239 588 226 C655 244 724 286 787 333 L648 474 C592 466 530 458 466 454 C430 414 363 367 287 316 Z",
  "part-midsole": "M54 437 C213 456 355 462 510 471 C691 482 907 478 1129 441 C1170 446 1198 466 1189 493 C1170 537 1098 563 1008 568 C790 574 575 564 381 558 C230 553 112 554 68 516 C50 495 43 463 54 437 Z",
  "part-outsole": "M66 516 C189 552 351 551 510 554 C716 562 928 579 1121 548 C1160 540 1182 549 1160 574 C1105 620 960 616 814 608 C604 599 392 597 216 603 C130 606 76 584 66 516 Z",
};

const MATERIAL_PRESETS = [
  { label: "Engineered knit", finish: "MATTE / TWO-DENSITY" },
  { label: "Injected TPU", finish: "MATTE" },
  { label: "Compression-molded EVA", finish: "MOLDED" },
  { label: "Carbon rubber", finish: "TEXTURED" },
];

const PALETTE = ["#C8C7BE", "#4B4B49", "#DED9CC", "#171717"];

type RegionMapInteractiveProps = {
  document: TechPackDocument;
  selectedPartId: string;
  onSelectPart: (partId: string) => void;
  onUpdateParts: (partIds: string[], patch: Partial<TechPackPart>) => void;
  onApplyPalette: (colors: string[]) => void;
  onReset: () => void;
  onViewDocument: () => void;
};

export function RegionMapInteractive({
  document,
  selectedPartId,
  onSelectPart,
  onUpdateParts,
  onApplyPalette,
  onReset,
  onViewDocument,
}: RegionMapInteractiveProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedPartId ? [selectedPartId] : []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [detailPartId, setDetailPartId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const detailPart = document.parts.find((part) => part.id === detailPartId) ?? null;

  const activatePart = (
    partId: string,
    options: { toggle?: boolean; range?: boolean } = {},
  ) => {
    let nextIds: string[];
    if (options.range && selectedIds[0]) {
      const from = document.parts.findIndex((part) => part.id === selectedIds[0]);
      const to = document.parts.findIndex((part) => part.id === partId);
      const [start, end] = from <= to ? [from, to] : [to, from];
      nextIds = document.parts.slice(start, end + 1).map((part) => part.id);
    } else if (options.toggle) {
      nextIds = selected.has(partId) ? selectedIds.filter((id) => id !== partId) : [...selectedIds, partId];
    } else {
      nextIds = [partId];
    }
    setSelectedIds(nextIds);
    if (nextIds.length > 0) onSelectPart(partId);
  };

  const openDetail = (partId: string) => {
    activatePart(partId);
    setDetailPartId(partId);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-[#111216]">
      <section className="relative min-w-0 flex-1 overflow-hidden bg-[#101114]">
        <div
          className="absolute inset-0 opacity-35"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <div className="absolute left-5 top-5 z-30 flex items-center gap-2 rounded-xl border border-white/10 bg-[#1D1E23]/95 px-3 py-2 shadow-2xl backdrop-blur">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5B55F7] text-xs font-bold">R</span>
          <div>
            <p className="text-xs font-semibold">Region Map</p>
            <p className="text-[10px] text-white/40">{selectedIds.length > 1 ? `${selectedIds.length} regions selected` : "Click the product to select a region"}</p>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center p-16">
          <div className="relative w-full max-w-[980px]" style={{ aspectRatio: "1344 / 681" }}>
            <Image
              src={document.primarySource.imageUrl}
              alt={document.title}
              fill
              unoptimized
              sizes="980px"
              className={`object-contain transition ${selectedIds.length > 0 && !showOriginal ? "brightness-[0.82]" : ""}`}
            />
            <svg
              viewBox="0 0 1344 681"
              className="absolute inset-0 h-full w-full overflow-visible"
              role="img"
              aria-label="Interactive Region Map"
            >
              {document.parts.map((part) => {
                const isSelected = selected.has(part.id);
                const isHovered = hoveredId === part.id;
                const path = REGION_PATHS[part.id];
                const commonProps = {
                  fill: showOriginal ? "transparent" : part.colorHex,
                  fillOpacity: showOriginal ? 0 : isSelected ? 0.58 : isHovered ? 0.45 : 0.24,
                  stroke: isSelected || isHovered ? "#FFFFFF" : "rgba(255,255,255,0.16)",
                  strokeWidth: isSelected ? 5 : isHovered ? 3 : 1,
                  style: { mixBlendMode: "color" as const, cursor: "pointer", filter: isSelected ? "drop-shadow(0 0 9px rgba(255,255,255,0.9))" : undefined },
                  onMouseEnter: () => setHoveredId(part.id),
                  onMouseLeave: () => setHoveredId(null),
                  onClick: (event: React.MouseEvent<SVGElement>) => {
                    event.stopPropagation();
                    activatePart(part.id, { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey });
                  },
                  onDoubleClick: (event: React.MouseEvent<SVGElement>) => {
                    event.stopPropagation();
                    openDetail(part.id);
                  },
                };
                return path ? (
                  <path key={part.id} data-region-id={part.id} d={path} {...commonProps} />
                ) : (
                  <circle key={part.id} data-region-id={part.id} cx={part.anchor.x * 1344} cy={part.anchor.y * 681} r={52} {...commonProps} />
                );
              })}
            </svg>
            {document.parts.map((part, index) => {
              if (!selected.has(part.id) && hoveredId !== part.id) return null;
              return (
                <div
                  key={part.id}
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#17181C] px-2 py-1 text-[10px] font-bold text-white shadow-xl"
                  style={{ left: `${part.anchor.x * 100}%`, top: `${part.anchor.y * 100}%` }}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#1D1E23]/95 p-2 shadow-2xl backdrop-blur">
          <span className="px-2 text-[11px] text-white/45">Region changes update callouts + BOM</span>
          <button type="button" onClick={onViewDocument} className="flex h-9 items-center gap-2 rounded-lg bg-[#5B55F7] px-4 text-xs font-semibold hover:bg-[#6B65FF]">
            <FileText className="h-4 w-4" /> View document
          </button>
        </div>
      </section>

      <aside className="flex w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#202126]">
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            {detailPart ? (
              <button type="button" aria-label="Back to all regions" onClick={() => setDetailPartId(null)} className="rounded-full p-1 text-white/55 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /></button>
            ) : null}
            <p className="text-sm font-semibold">{detailPart ? detailPart.name : "Regions"}</p>
            {!detailPart ? <span className="rounded bg-[#7B5B20] px-1.5 py-0.5 text-[9px] font-bold text-[#FFD65C]">BETA</span> : null}
          </div>
          {!detailPart ? <span className="text-[11px] text-white/35">{document.parts.length}</span> : null}
        </div>

        {detailPart ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-[#15161A] p-3">
              <div className="relative aspect-[2/1] overflow-hidden rounded-lg bg-white">
                <Image src={document.primarySource.imageUrl} alt="" fill unoptimized sizes="280px" className="object-contain" />
                <svg viewBox="0 0 1344 681" className="absolute inset-0 h-full w-full">
                  {REGION_PATHS[detailPart.id] ? <path d={REGION_PATHS[detailPart.id]} fill={detailPart.colorHex} fillOpacity="0.58" stroke="white" strokeWidth="5" style={{ mixBlendMode: "color" }} /> : null}
                </svg>
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">Region name<input aria-label="Region part name" value={detailPart.name} onChange={(event) => onUpdateParts([detailPart.id], { name: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF]" /></label>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Color</p>
                <div className="mt-2 flex items-center gap-2">
                  <input aria-label="Region color picker" type="color" value={detailPart.colorHex} onChange={(event) => onUpdateParts([detailPart.id], { colorHex: event.target.value.toUpperCase() })} className="h-10 w-12 rounded-md border border-white/10 bg-black/20 p-1" />
                  <input aria-label="Region color name" value={detailPart.colorName} onChange={(event) => onUpdateParts([detailPart.id], { colorName: event.target.value })} className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-2.5 text-xs text-white outline-none focus:border-[#6962FF]" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Material</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {MATERIAL_PRESETS.map((preset) => (
                    <button key={preset.label} type="button" onClick={() => onUpdateParts([detailPart.id], { material: preset.label, finish: preset.finish })} className={`rounded-lg border p-2 text-left text-[10px] leading-4 ${detailPart.material === preset.label ? "border-[#6962FF] bg-[#6962FF]/10 text-white" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25"}`}>{preset.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">Finish<input aria-label="Region finish" value={detailPart.finish} onChange={(event) => onUpdateParts([detailPart.id], { finish: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF]" /></label>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35">MPN<input aria-label="Region MPN" value={detailPart.materialPartNumber} onChange={(event) => onUpdateParts([detailPart.id], { materialPartNumber: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-normal normal-case text-white outline-none focus:border-[#6962FF]" /></label>
              </div>
              <p className="text-[10px] text-white/30">{detailPart.regionLayerId} · alpha anchor {Math.round(detailPart.anchor.x * 100)}%, {Math.round(detailPart.anchor.y * 100)}%</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-xs font-semibold text-white/60">All Regions</span>
              <div className="relative">
                <button type="button" onClick={() => setPaletteOpen((open) => !open)} className="flex -space-x-1 rounded-md p-1 hover:bg-white/5" aria-label="Apply palette to all regions">
                  {PALETTE.map((color) => <span key={color} className="h-5 w-5 rounded-full border-2 border-[#202126]" style={{ backgroundColor: color }} />)}
                </button>
                {paletteOpen ? (
                  <button type="button" onClick={() => { onApplyPalette(PALETTE); setPaletteOpen(false); }} className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-white/10 bg-[#2A2B31] p-3 text-left text-xs shadow-xl hover:bg-[#33343A]">Apply palette to all</button>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {document.parts.map((part) => {
                const isSelected = selected.has(part.id);
                const isHovered = hoveredId === part.id;
                return (
                  <div key={part.id} className={`flex min-h-10 items-center gap-2 rounded-md border px-2 ${isSelected ? "border-[#6962FF] bg-[#6962FF]/10" : isHovered ? "border-transparent bg-white/[0.07]" : "border-transparent"}`} onMouseEnter={() => setHoveredId(part.id)} onMouseLeave={() => setHoveredId(null)}>
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-xs text-white/75" onClick={(event) => activatePart(part.id, { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey })} onDoubleClick={() => openDetail(part.id)}>{part.name}</button>
                    <input aria-label={`Edit ${part.name} color`} type="color" value={part.colorHex} onChange={(event) => onUpdateParts([part.id], { colorHex: event.target.value.toUpperCase() })} className="h-6 w-7 rounded border border-white/15 bg-transparent p-0.5" />
                    <button type="button" aria-label={`Open ${part.name} details`} onClick={() => openDetail(part.id)} className="rounded-full p-1 text-white/30 hover:bg-white/10 hover:text-white"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/10 p-3">
              <label className="flex h-9 items-center justify-between text-xs text-white/55">Show original<button type="button" role="switch" aria-checked={showOriginal} onClick={() => setShowOriginal((show) => !show)} className={`relative h-5 w-9 rounded-full transition ${showOriginal ? "bg-[#5B55F7]" : "bg-white/15"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${showOriginal ? "left-[18px]" : "left-0.5"}`} /></button></label>
              {selectedIds.length > 1 ? (
                <div className="mb-2 rounded-lg border border-[#6962FF]/30 bg-[#6962FF]/10 p-2.5 text-[11px] text-white/60">{selectedIds.length} regions selected. Inline color edits can be applied together from detail mode.</div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={onReset} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 text-xs text-white/60 hover:bg-white/5"><RotateCcw className="h-3.5 w-3.5" /> Reset all</button>
                <button type="button" onClick={onViewDocument} className="h-9 rounded-lg bg-[#5B55F7] text-xs font-semibold hover:bg-[#6B65FF]">Update document</button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
