"use client";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { notify } from "@/components/ui/sonner";
import { getApiUrl } from "@/utils/api";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { usePathname, useRouter } from "next/navigation";
import { syncStoreAfterCodexSignOut } from "@/utils/storeHelpers";
import {
  DEFAULT_CODEX_MODEL,
  isSupportedCodexModel,
} from "@/utils/codexModels";

interface CodexConfigProps {
  codexModel: string;
  onInputChange: (value: string | boolean, field: string) => void;
  onAuthStatusChange?: (authenticated: boolean) => void;
}

type AuthStatus = "checking" | "unauthenticated" | "polling" | "authenticated";

interface StatusResponse {
  status: string;
  account_id?: string;
  username?: string;
  email?: string;
  is_pro?: boolean;
  verification_url?: string;
  user_code?: string;
  expires_at?: number;
  interval?: number;
  detail?: string;
}

export default function CodexConfig({
  codexModel,
  onInputChange,
  onAuthStatusChange,
}: CodexConfigProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    checkCurrentAuthStatus();
    return () => stopPolling();
  }, []);

  useEffect(() => {
    onAuthStatusChange?.(authStatus === "authenticated");
  }, [authStatus, onAuthStatusChange]);

  useEffect(() => {
    if (codexModel && !isSupportedCodexModel(codexModel)) {
      onInputChange(DEFAULT_CODEX_MODEL, "codex_model");
    }
  }, [codexModel, onInputChange]);

  const applyProfile = (data: Partial<StatusResponse>) => {
    setAccountId(data.account_id ?? null);
    setUsername(data.username ?? null);
    setEmail(data.email ?? null);
  };

  const applyDeviceSession = (data: Partial<StatusResponse>) => {
    setVerificationUrl(data.verification_url ?? null);
    setUserCode(data.user_code ?? null);
    setExpiresAt(typeof data.expires_at === "number" ? data.expires_at : null);
  };

  const checkCurrentAuthStatus = async () => {
    try {
      const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/status"));
      if (!res.ok) {
        setAuthStatus("unauthenticated");
        applyProfile({});
        return;
      }
      const data: StatusResponse = await res.json();
      if (data.status === "authenticated") {
        onInputChange('codex', 'LLM');
        if (!isSupportedCodexModel(codexModel)) {
          onInputChange(DEFAULT_CODEX_MODEL, 'codex_model');
        }
        setAuthStatus("authenticated");
        applyProfile(data);
      } else {
        setAuthStatus("unauthenticated");
        applyProfile({});
      }
    } catch {
      setAuthStatus("unauthenticated");
      applyProfile({});
    }
  };

  const handleSignIn = async () => {
    try {

      trackEvent(MixpanelEvent.Codex_SignIn_API_Call);
      onInputChange('codex', 'LLM');

      const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/initiate"), {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to initiate auth");
      const data = await res.json();
      const { session_id, verification_url } = data;

      applyDeviceSession(data);
      setAuthStatus("polling");
      window.open(verification_url, "_blank", "noopener,noreferrer");

      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(
            getApiUrl(`/api/v1/ppt/codex/auth/status/${session_id}`)
          );
          if (!pollRes.ok) return;
          const pollData: StatusResponse = await pollRes.json();

          if (pollData.status === "success") {
            trackEvent(MixpanelEvent.Codex_SignIn_Completed, { method: "browser_poll" });
            stopPolling();
            setAuthStatus("authenticated");
            applyProfile(pollData);
            applyDeviceSession({});
            if (!isSupportedCodexModel(codexModel)) {
              onInputChange(DEFAULT_CODEX_MODEL, "codex_model");
            }
            notify.success(
              "Signed in to ChatGPT",
              "Your ChatGPT account is connected and ready to use."
            );
          } else if (pollData.status === "failed") {
            trackEvent(MixpanelEvent.Codex_SignIn_Failed, { method: "browser_poll" });
            stopPolling();
            setAuthStatus("unauthenticated");
            applyProfile({});
            applyDeviceSession({});
            notify.error(
              "Sign-in failed",
              pollData.detail || "Authentication did not complete. Please try signing in again."
            );
          } else {
            applyDeviceSession(pollData);
          }
        } catch {
          // keep polling on transient errors
        }
      }, Math.max(3, Number(data.interval || 5)) * 1000);
    } catch {
      trackEvent(MixpanelEvent.Codex_SignIn_Failed, { method: "initiate" });
      notify.error(
        "Sign-in failed",
        "Could not start the sign-in flow. Please try again."
      );
      setAuthStatus("unauthenticated");
      applyProfile({});
      applyDeviceSession({});
    }
  };

  const handleCancelPolling = () => {
    trackEvent(MixpanelEvent.Codex_SignIn_Cancelled);
    stopPolling();
    applyDeviceSession({});
    setAuthStatus("unauthenticated");
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await fetch(getApiUrl("/api/v1/ppt/codex/auth/logout"), { method: "POST" });
      trackEvent(MixpanelEvent.Codex_Signed_Out);
      setAuthStatus("unauthenticated");
      setAccountId(null);
      setUsername(null);
      setEmail(null);
      onInputChange("", "codex_model");
      syncStoreAfterCodexSignOut();
      router.replace(pathname.startsWith("/settings") ? "/settings" : "/");
      notify.success(
        "Signed out",
        "You have been disconnected from ChatGPT."
      );
    } catch {
      notify.error(
        "Sign-out failed",
        "Could not disconnect from ChatGPT. Please try again."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/refresh"), {
        method: "POST",
      });
      if (!res.ok) throw new Error("Refresh failed");
      const data = await res.json();
      setAuthStatus("authenticated");
      applyProfile(data);
      notify.success(
        "Session refreshed",
        "Your ChatGPT connection was renewed successfully."
      );
    } catch {
      notify.error(
        "Session refresh failed",
        "Your ChatGPT session could not be renewed. Please sign in again."
      );
      setAuthStatus("unauthenticated");
      applyProfile({});
      applyDeviceSession({});
    } finally {
      setIsRefreshing(false);
    }
  };

  if (authStatus === "checking") {
    return (
      <div className="mb-5 w-full p-3 border border-[#EDEEEF] font-syne rounded-[8px] flex items-center gap-6">
        <div className="w-[74px] h-[74px] bg-[#333333] rounded-full flex items-center justify-center shrink-0">
          <Loader2 className="w-10 h-10 text-[#191919] animate-spin" />
        </div>
        <div className="text-start flex-1 min-w-0">
          <h4 className="text-[#191919] text-lg font-medium">Checking status</h4>
          <p className="text-[#B3B3B3] text-sm font-normal">
            Verifying your ChatGPT connection…
          </p>
        </div>
      </div>
    );
  }

  if (authStatus === "polling") {
    return (
      <div className="mb-5 space-y-4 font-syne">
        <div className="w-full p-3 border border-[#EDEEEF] rounded-[8px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0 flex-1">
            <div className="w-[40px] h-[40px] bg-[#EDEEEF] rounded-full flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-[#191919] animate-spin" />
            </div>
            <div className="text-start min-w-0">
              <h4 className="text-[#191919] text-lg font-medium">Waiting for sign-in</h4>
              <p className="text-[#B3B3B3] text-sm font-normal">
                Complete sign-in in the browser tab we opened.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelPolling}
            className="shrink-0 text-sm text-[#B3B3B3] hover:text-[#191919] underline underline-offset-2 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-3 rounded-[8px] border border-[#EDEEEF] p-3">
          <p className="text-[#191919] text-xs font-normal">
            Enter this code on the ChatGPT sign-in page
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-xl font-semibold tracking-wider text-[#191919]">
              {userCode || "------"}
            </div>
            {verificationUrl && (
              <button
                type="button"
                onClick={() => window.open(verificationUrl, "_blank", "noopener,noreferrer")}
                className="shrink-0 px-4 py-2.5 bg-[#EDEEEF] hover:bg-[#E4E5E6] rounded-[8px] text-sm font-medium text-[#191919] transition-colors"
              >
                Open ChatGPT
              </button>
            )}
          </div>
          {expiresAt && (
            <p className="text-[#B3B3B3] text-xs font-normal">
              Code expires in {Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000))} min
            </p>
          )}
        </div>
      </div>
    );
  }

  if (authStatus === "authenticated") {

    return (
      <div className=" mb-5">
        <div className="flex items-center justify-between gap-3 p-5  border border-[#EDEEEF] rounded-[8px]">
          <div className="flex items-center gap-3">

            <div className="w-[40px] h-[40px] bg-[#333333] rounded-full flex items-center justify-center" >

              <img src="/providers/OpenAI-white.png" alt="openai Logo" className="w-[27px] h-[27px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-medium text-[#191919] truncate">
                  {username || email || (accountId ? `Account ${accountId}` : "ChatGPT Account")}
                </p>

              </div>
              {email && username && (
                <p className="text-xs text-[#B3B3B3] truncate">{email}</p>
              )}
              {!email && accountId && (
                <p className="text-xs text-[#B3B3B3] truncate">ID: {accountId}</p>
              )}
              <p className="text-xs text-[#B3B3B3]">Signed in to ChatGPT</p>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              title="Refresh token"
              className="flex items-center justify-center px-3.5 py-2.5  border border-[#EDEEEF] rounded-[58px] minid:opacity-40 transition-colors"
            >
              {isRefreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#191919]" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-[#191919]" />
              )}
            </button>
            <button
              onClick={handleSignOut}
              disabled={isLoggingOut}
              title="Sign out"
              className="flex items-center justify-center px-3.5 py-2.5  border border-[#EDEEEF] rounded-[58px]  disabled:opacity-40 transition-colors"
            >
              {isLoggingOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#191919]" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 text-[#191919]" />
              )}
            </button>
          </div>
        </div>


      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className=" w-full  p-5 border border-[#EDEEEF] font-syne  hover:bg-[#F7F6F9] transition-colors duration-300   rounded-[12px] flex items-center   justify-between  "
    >
      <div className="flex items-center gap-2 flex-1">
        <div className="w-[40px] h-[40px] bg-[#333333] rounded-full flex items-center justify-center" >

          <img src="/providers/OpenAI-white.png" alt="openai Logo" className="w-[27px] h-[27px]" />
        </div>
        <div className="text-start flex-1">
          <h4 className="text-[#191919] text-sm font-medium">Sign in with ChatGPT</h4>
          <p className="text-[#B3B3B3]   text-xs font-normal">Use your ChatGPT account — no API  key required</p>
        </div>
      </div>
      <ArrowRight className="w-[22px] h-[22px] text-[#4C4C4C]" />
    </button>
  );
}
