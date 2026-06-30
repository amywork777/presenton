import Image from "next/image";

import { cn } from "@/lib/utils";

interface PresentonSplashLoaderProps {
  message?: string;
  className?: string;
}

export const PRESENTON_SPLASH_MIN_DURATION_MS = 3000;

export function PresentonSplashLoader({
  message = "Preparing your workspace",
  className,
}: PresentonSplashLoaderProps) {
  return (
    <main
      aria-busy="true"
      aria-label={message}
      className={cn(
        "fixed inset-0 z-[2147483000] flex min-h-screen items-center justify-center overflow-hidden bg-white",
        className
      )}
      role="status"
    >
      <div className="presenton-splash-circle" aria-hidden="true" />
      <Image
        src="/Presenton_Splash.png"
        alt="Presenton"
        width={1023}
        height={342}
        priority
        className="presenton-splash-logo"
      />

      <style jsx>{`
        .presenton-splash-circle {
          position: absolute;
          width: clamp(240px, 28vw, 326px);
          height: clamp(240px, 28vw, 326px);
          border-radius: 9999px;
          background: #7A5AF8;
          animation: presenton-splash-expand 2.85s
            cubic-bezier(0.76, 0, 0.24, 1) forwards;
          transform-origin: center;
          will-change: transform;
        }

        :global(.presenton-splash-logo) {
          position: relative;
          z-index: 1;
          display: block;
          width: clamp(210px, 24vw, 312px);
          height: auto;
          object-fit: contain;
        }

        @keyframes presenton-splash-expand {
          0%,
          44% {
            transform: scale(1);
          }

          100% {
            transform: scale(18);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .presenton-splash-circle {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
