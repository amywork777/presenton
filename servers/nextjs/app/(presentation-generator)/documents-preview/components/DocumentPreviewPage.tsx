/**
 * DocumentPreviewPage Component
 *
 * A component that displays and manages document previews for presentation generation.
 * Features:
 * - Document content preview with markdown support
 * - Sidebar navigation for documents
 * - Document content editing and saving
 * - Presentation generation workflow
 *
 * @component
 */

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { clearOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { getIconFromFile } from "../../utils/others";
import { ChevronRight, PanelRightOpen, X } from "lucide-react";
import ToolTip from "@/components/ToolTip";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

// Types
interface LoadingState {
  message: string;
  show: boolean;
  duration: number;
  progress: boolean;
}

interface TextContents {
  [key: string]: string;
}

interface FileItem {
  name: string;
  file_path: string;
}

const DocumentsPreviewPage: React.FC = () => {
  // Hooks
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Redux state
  const { config, files } = useSelector(
    (state: RootState) => state.pptGenUpload
  );

  // Local state
  const [textContents, setTextContents] = useState<TextContents>({});
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [downloadingDocuments, setDownloadingDocuments] = useState<string[]>(
    []
  );
  const [isOpen, setIsOpen] = useState(true);
  const [showLoading, setShowLoading] = useState<LoadingState>({
    message: "",
    show: false,
    duration: 10,
    progress: false,
  });

  // Memoized computed values
  const fileItems: FileItem[] = useMemo(() => {
    if (!files || !Array.isArray(files) || files.length === 0) return [];
    return files
      .flat()
      .filter((item: any) => item && item.name && item.file_path);
  }, [files]);

  const documentKeys = useMemo(() => {
    return fileItems.map((file) => file.name);
  }, [fileItems]);

  const updateSelectedDocument = (value: string) => {
    setSelectedDocument(value);
    if (textareaRef.current) {
      textareaRef.current.value = textContents[value] || "";
    }
  };

  const readFile = async (filePath: string) => {
    if (typeof window !== "undefined" && window.electron?.readFile) {
      return window.electron.readFile(filePath);
    }

    const res = await fetch(`/api/read-file`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
    return res.json();
  };

  const maintainDocumentTexts = async () => {
    const newDocuments: string[] = [];
    const promises: Promise<{ content: string }>[] = [];

    // Process documents
    documentKeys.forEach((key: string) => {
      if (!(key in textContents)) {
        newDocuments.push(key);
        const fileItem = fileItems.find((item) => item.name === key);
        if (fileItem) {
          promises.push(readFile(fileItem.file_path));
        }
      }
    });

    if (promises.length > 0) {
      setDownloadingDocuments(newDocuments);
      try {
        const results = await Promise.all(promises);
        setTextContents((prev) => {
          const newContents = { ...prev };
          newDocuments.forEach((key, index) => {
            newContents[key] = results[index].content || "";
          });
          return newContents;
        });
      } catch (error) {
        console.error("Error reading files:", error);
        notify.error("Could not read document", "Failed to read document content.");
      }
      setDownloadingDocuments([]);
    }
  };

  const handleCreatePresentation = async () => {
    try {
      setShowLoading({
        message: "Generating presentation outline...",
        show: true,
        duration: 40,
        progress: true,
      });

      const documentPaths = fileItems.map(
        (fileItem: FileItem) => fileItem.file_path
      );
      trackEvent(MixpanelEvent.DocumentsPreview_Create_Presentation_API_Call);
      const createResponse = await PresentationGenerationApi.createPresentation(
        {
          content: config?.prompt ?? "",
          n_slides: config?.slides ? parseInt(config.slides) : null,
          file_paths: documentPaths,
          language: config?.language ?? "",
          tone: config?.tone,
          verbosity: config?.verbosity,
          instructions: config?.instructions || null,
          include_table_of_contents: !!config?.includeTableOfContents,
          include_title_slide: !!config?.includeTitleSlide,
          web_search: !!config?.webSearch,
        }
      );

      dispatch(clearOutlines());
      dispatch(setPresentationId(createResponse.id));
      trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/outline" });
      router.replace("/outline");
    } catch (error: any) {
      console.error("Error in radar presentation creation:", error);
      notify.error("Creation failed", error.message || "Something went wrong while creating the presentation.");
      setShowLoading({
        message: "Error in radar presentation creation.",
        show: true,
        duration: 10,
        progress: false,
      });
    } finally {
      setShowLoading({
        message: "",
        show: false,
        duration: 10,
        progress: false,
      });
    }
  };

  // Effects
  useEffect(() => {
    if (documentKeys.length > 0) {
      setSelectedDocument(documentKeys[0]);
      maintainDocumentTexts();
    }
  }, [documentKeys]);

  // Render helpers
  const renderDocumentContent = () => {
    if (!selectedDocument) return null;

    const isDocument = documentKeys.includes(selectedDocument);
    const selectedDocumentName = selectedDocument.split("/").pop() ?? selectedDocument;

    if (!isDocument) return null;

    return (
      <div className="h-full overflow-y-auto custom_scrollbar px-4 pb-24 pt-6 sm:px-8">
        <div className="mx-auto w-full max-w-[900px]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A5AF8]">
                Document Preview
              </p>
              <h1 className="mt-2 truncate text-2xl font-semibold text-[#16161D] sm:text-3xl">
                {selectedDocumentName}
              </h1>
            </div>
            <span className="hidden shrink-0 rounded-full border border-[#E4E2EB] bg-white px-3 py-1 text-xs font-medium text-[#686875] sm:inline-flex">
              {documentKeys.indexOf(selectedDocument) + 1} of {documentKeys.length}
            </span>
          </div>

          <div className="min-h-[calc(100vh-220px)] rounded-[12px] border border-[#E6E7EC] bg-white px-7 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-12 sm:py-10">
            {downloadingDocuments.includes(selectedDocument) ? (
              <Skeleton className="h-[520px] w-full" />
            ) : (
              <div className="whitespace-pre-wrap break-words font-serif text-[15px] leading-8 text-[#262632] sm:text-base">
                {textContents[selectedDocument] || ""}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    if (!isOpen) return null;

    return (
      <aside className="fixed z-50 h-[calc(100vh-112px)] w-[280px] max-w-[calc(100vw-32px)] rounded-[12px] border border-[#E2E4EA] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)] transition-all duration-300 ease-in-out xl:relative xl:z-auto xl:shrink-0 xl:shadow-sm">
        <div className="flex items-center justify-between border-b border-[#ECECF1] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A7A86]">Documents</p>
            <p className="mt-1 text-sm font-medium text-[#191919]">{documentKeys.length} uploaded</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#5F6070] hover:bg-[#F6F6F9] hover:text-[#191919]"
            aria-label="Close documents panel"
          >
            <X size={18} />
          </button>
        </div>

        {documentKeys.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-col gap-2">
              {documentKeys.map((key: string) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => updateSelectedDocument(key)}
                  className={`${selectedDocument === key
                    ? "border-[#7A5AF8] bg-[#F4F3FF] text-[#332A80] shadow-sm"
                    : "border-transparent bg-[#FAFAFB] text-[#2E2E2E] hover:border-[#E0E0E6] hover:bg-white"
                    } flex w-full items-center gap-3 rounded-[8px] border p-3 text-left transition-colors`}
                >
                  <img
                    className="h-7 w-7 shrink-0 rounded border border-gray-200 bg-white"
                    src={getIconFromFile(key)}
                    alt="Document icon"
                  />
                  <span className="truncate text-sm font-medium">
                    {key.split("/").pop() ?? "file.txt"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F5F6FA]">
      <OverlayLoader
        show={showLoading.show}
        text={showLoading.message}
        showProgress={showLoading.progress}
        duration={showLoading.duration}
      />
      <Header />
      <div className="flex flex-1 gap-4 px-4 py-5 font-instrument_sans sm:px-6">
        {!isOpen && (
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
            <ToolTip content="Open Panel">
              <Button
                onClick={() => setIsOpen(true)}
                className="bg-[#5146E5] text-white p-3 shadow-lg"
              >
                <PanelRightOpen className="text-white" size={20} />
              </Button>
            </ToolTip>
          </div>
        )}

        {renderSidebar()}

        <main className="h-[calc(100vh-112px)] min-w-0 flex-1 overflow-hidden rounded-[16px] border border-[#E4E5EB] bg-[#EEF0F5]">
          {renderDocumentContent()}
        </main>

        <div className="fixed bottom-5 right-5">
          <Button
            onClick={handleCreatePresentation}
            className="flex items-center gap-2 px-8 py-6 rounded-sm text-md bg-[#5146E5] hover:bg-[#5146E5]/90"
          >
            <span className="text-white font-semibold">Next</span>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPreviewPage;
