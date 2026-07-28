import { LOCAL_TAILWIND_BROWSER_URL } from "@/lib/vendor-assets";

const TAILWIND_RUNTIME_ATTRIBUTE = "data-presenton-tailwind-runtime";

/**
 * Load Tailwind's browser compiler from this Presenton server. This preserves
 * support for arbitrary classes in user-provided template HTML without making
 * a request to the public Tailwind CDN.
 */
export function ensureTailwindBrowserRuntime(): HTMLScriptElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[${TAILWIND_RUNTIME_ATTRIBUTE}], script[src="${LOCAL_TAILWIND_BROWSER_URL}"]`
  );
  if (existingScript) {
    return existingScript;
  }

  const script = document.createElement("script");
  script.setAttribute(TAILWIND_RUNTIME_ATTRIBUTE, "true");
  script.src = LOCAL_TAILWIND_BROWSER_URL;
  script.async = true;
  document.head.appendChild(script);
  return script;
}
