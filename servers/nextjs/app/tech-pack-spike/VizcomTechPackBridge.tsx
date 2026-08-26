"use client";

import { useEffect, useState } from "react";
import { TechPackSpike } from "./TechPackSpike";
import type { TechPackDocument } from "./techPackModel";

export const VIZCOM_TECH_PACK_OPEN = "vizcom-tech-pack:open";
export const VIZCOM_TECH_PACK_READY = "vizcom-tech-pack:ready";

type TechPackOpenMessage = {
  type: typeof VIZCOM_TECH_PACK_OPEN;
  document: TechPackDocument;
};

const isTechPackDocument = (value: unknown): value is TechPackDocument => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TechPackDocument>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    !!candidate.primarySource &&
    Array.isArray(candidate.parts) &&
    Array.isArray(candidate.views)
  );
};

/**
 * Keeps the slide editor independent from Vizcom's React tree. The Workbench
 * owns the manufacturing document and sends a structured snapshot after this
 * embedded editor announces that it is ready.
 */
export function VizcomTechPackBridge({
  fallback,
}: {
  fallback: TechPackDocument;
}) {
  const [document, setDocument] = useState(fallback);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      const message = event.data as Partial<TechPackOpenMessage> | null;
      if (
        !message ||
        message.type !== VIZCOM_TECH_PACK_OPEN ||
        !isTechPackDocument(message.document)
      ) {
        return;
      }
      setDocument(message.document);
    };

    window.addEventListener("message", receive);
    window.parent.postMessage({ type: VIZCOM_TECH_PACK_READY }, "*");
    return () => window.removeEventListener("message", receive);
  }, []);

  return <TechPackSpike key={document.id} document={document} />;
}
