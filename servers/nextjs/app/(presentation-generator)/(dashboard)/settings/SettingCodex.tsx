"use client";
import { useEffect, useRef, useState } from "react";
import {
    Check,
    ChevronUp,
    Loader2,
    RefreshCw,
    Trash2,
    UserCheck,
} from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/sonner";
import { getApiUrl } from "@/utils/api";
import { Button } from "@/components/ui/button";
import {
    CODEX_MODELS,
    DEFAULT_CODEX_MODEL,
    isSupportedCodexModel,
} from "@/utils/codexModels";
import { useRouter } from "next/navigation";
import { syncStoreAfterCodexSignOut } from "@/utils/storeHelpers";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

interface CodexConfigProps {
    codexModel: string;
    onInputChange: (value: string | boolean, field: string) => void;
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
    const [openModelSelect, setOpenModelSelect] = useState(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
            applyProfile({});
            onInputChange("codex", "LLM");
            onInputChange('', "codex_model");
            syncStoreAfterCodexSignOut();
            router.replace("/settings");
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
        } finally {
            setIsRefreshing(false);
        }
    };

    if (authStatus === "checking") {
        return (
            <div className="flex items-center gap-2 py-3 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Checking status…</span>
            </div>
        );
    }

    if (authStatus === "polling") {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 py-2">
                    <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    <span className="text-sm text-gray-600">Waiting for sign-in…</span>
                    <button
                        onClick={handleCancelPolling}
                        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-auto"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-3 rounded-lg border border-[#EDEEEF] p-3">
                    <p className="text-xs text-gray-400">
                        Enter this code on the ChatGPT sign-in page
                    </p>
                    <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-lg font-semibold tracking-wider text-[#101323]">
                            {userCode || "------"}
                        </div>
                        {verificationUrl && (
                            <button
                                type="button"
                                onClick={() => window.open(verificationUrl, "_blank", "noopener,noreferrer")}
                                className="px-3 py-2 bg-[#EDEEEF] hover:bg-[#E4E5E6] rounded-lg text-xs font-medium text-[#101323] transition-colors"
                            >
                                Open ChatGPT
                            </button>
                        )}
                    </div>
                    {expiresAt && (
                        <p className="text-xs text-gray-400">
                            Code expires in {Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000))} min
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (authStatus === "authenticated") {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 p-3  border border-[#EDEEEF] rounded-lg">
                    <UserCheck className="w-5 h-5 text-black shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                                {username || email || (accountId ? `Account ${accountId}` : "ChatGPT Account")}
                            </p>

                        </div>
                        {email && username && (
                            <p className="text-xs text-gray-500 truncate">{email}</p>
                        )}
                        {!email && accountId && (
                            <p className="text-xs text-gray-500 truncate">ID: {accountId}</p>
                        )}
                        <p className="text-xs text-gray-400">Signed in to ChatGPT</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                        <button
                            onClick={handleRefreshToken}
                            disabled={isRefreshing}
                            title="Refresh token"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EDEEEF] hover:bg-[#E4E5E6] disabled:opacity-40 transition-colors"
                        >
                            {isRefreshing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                            ) : (
                                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                            )}
                        </button>
                        <button
                            onClick={handleSignOut}
                            disabled={isLoggingOut}
                            title="Sign out"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EDEEEF] hover:bg-[#E4E5E6] disabled:opacity-40 transition-colors"
                        >
                            {isLoggingOut ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                            ) : (
                                <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                            )}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select GPT Model
                    </label>
                    <Popover open={openModelSelect} onOpenChange={setOpenModelSelect}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openModelSelect}
                                className="w-full h-10 px-3 outline-none border border-gray-300 rounded-lg hover:border-gray-400 justify-between"
                            >
                                <span className="text-sm text-gray-900">
                                    {codexModel
                                        ? (CODEX_MODELS.find((m) => m.id === codexModel)?.name ?? codexModel)
                                        : "Select a model"}
                                </span>
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="p-0"
                            align="start"
                            style={{ width: "var(--radix-popover-trigger-width)" }}
                        >
                            <Command>
                                <CommandInput placeholder="Search models…" />
                                <CommandList>
                                    <CommandEmpty>No model found.</CommandEmpty>
                                    <CommandGroup>
                                        {CODEX_MODELS.map((model) => (
                                            <CommandItem
                                                key={model.id}
                                                value={model.id}
                                                onSelect={(value) => {
                                                    trackEvent(MixpanelEvent.Settings_Model_Selected, {
                                                        provider: "codex",
                                                        model: value,
                                                    });
                                                    onInputChange(value, "codex_model");
                                                    setOpenModelSelect(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        codexModel === model.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <span className="text-sm text-gray-900">
                                                    {model.name}
                                                </span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleSignIn}
            className="mt-8 py-2.5 px-3.5 bg-[#EDEEEF] hover:bg-[#E4E5E6] rounded-[48px] text-xs font-semibold text-[#101323] transition-colors"
        >
            Sign in with ChatGPT
        </button>
    );
}
