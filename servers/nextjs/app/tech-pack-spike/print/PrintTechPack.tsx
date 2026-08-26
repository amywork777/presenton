"use client";

import { useEffect, useMemo, useState } from "react";
import { templateV2UiToHtmlFragment } from "@/lib/template-v2-json-to-html";
import { TECH_PACK_PAGE_SIZE, techPackToEditorPages, type TechPackEditorPage } from "../techPackAdapter";
import type { TechPackDocument } from "../techPackModel";

export function PrintTechPack({ document }: { document: TechPackDocument }) {
  const defaults = useMemo(() => techPackToEditorPages(document), [document]);
  const [pages, setPages] = useState<TechPackEditorPage[]>(defaults);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("vizcom-tech-pack-spike-pages");
      if (saved) setPages(JSON.parse(saved) as TechPackEditorPage[]);
    } catch {
      setPages(defaults);
    }
  }, [defaults]);

  return (
    <main className="print-root min-h-screen bg-[#E7E8EC] py-8 print:bg-white print:py-0">
      <div className="print-controls fixed right-5 top-5 z-50 flex gap-2 print:hidden">
        <button type="button" onClick={() => window.close()} className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm shadow">Back</button>
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#5B55F7] px-4 py-2 text-sm font-semibold text-white shadow">Save as PDF</button>
      </div>
      <div className="mx-auto flex w-fit flex-col gap-8 print:block">
        {pages.map((page) => {
          const html = templateV2UiToHtmlFragment(page.layout, TECH_PACK_PAGE_SIZE);
          return (
            <section
              key={page.id}
              className="print-page overflow-hidden bg-white shadow-xl print:shadow-none"
              style={{ width: TECH_PACK_PAGE_SIZE.width, height: TECH_PACK_PAGE_SIZE.height }}
              dangerouslySetInnerHTML={{ __html: html ?? "" }}
            />
          );
        })}
      </div>
      <style jsx global>{`
        @page { size: 17in 11in; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; background: white; }
          .print-page { width: 17in !important; height: 11in !important; page-break-after: always; break-after: page; }
          .print-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
    </main>
  );
}
