"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "./hooks/useChat";
import { isAuthenticated, clearToken } from "./hooks/useAuth";
import LoadingIsland from "./components/Island/LoadingIsland";
import ChatIsland from "./components/Island/ChatIsland";
import IdleIsland from "./components/Island/IdleIsland";
import SessionsIsland from "./components/Island/SessionsIsland";
import { Linkedin } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const ok = isAuthenticated();
    if (!ok) {
      router.replace("/auth");
    } else {
      setAuthed(true);
    }
    setHydrated(true);
  }, [router]);

  const {
    platform, setPlatform,
    handle, setHandle,
    stage,
    loadingStep, setLoadingStep,
    profileData,
    messages,
    input, setInput,
    isSending,
    error,
    ragMode,
    setRagMode,
    pastSessions,
    isLoadingSessions,
    handleExtract,
    handleSend,
    handleReset,
    handleShowSessions,
    handleResumeSession,
  } = useChat();

  const handleSignOut = () => {
    clearToken();
    router.replace("/auth");
  };

  if (!hydrated || !authed) return null;

  return (
    <div className="min-h-screen bg-bg text-[#f0f0f0] font-['Syne',sans-serif] flex flex-col items-center justify-center p-6 relative">

      <div
        className="fixed inset-0 pointer-events-none z-100 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      <div className={`
        w-full flex flex-col items-center gap-4
        transition-all duration-500
        ${stage === "chat" ? "max-w-2xl" : "max-w-140"}
      `}>

        {stage === "idle" && (
          <div className="flex flex-col items-center w-full animate-fade-up">
            <div className="flex flex-col items-center text-center gap-4 mb-10 w-full">
              
              <h1 className="text-3xl md:text-[38px] font-bold tracking-tight text-[#f0f0f0] flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2">
                <span>Chat with anyone's</span>
                <Linkedin className="w-8 h-8 md:w-9 md:h-9 text-accent" strokeWidth={2.5} />
                <span className="text-white/40 text-2xl font-light italic">or</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="w-7 h-7 md:w-8 md:h-8 fill-current text-[#f0f0f0]">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </h1>
              
              <p className="text-[14px] text-white/40 max-w-[380px] leading-relaxed">
                Paste a public profile link to instantly extract their data and start asking questions.
              </p>
            </div>

            <IdleIsland
              handle={handle}
              platform={platform}
              onHandleChange={setHandle}
              onPlatformChange={setPlatform}
              onSubmit={handleExtract}
            />
            
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={handleShowSessions}
                disabled={isLoadingSessions}
                className="font-mono text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer bg-transparent border-none disabled:opacity-40"
              >
                {isLoadingSessions ? "loading…" : "↑ past sessions"}
              </button>
              <span className="text-white/10 font-mono text-xs">·</span>
              <button
                onClick={handleSignOut}
                className="font-mono text-[11px] text-white/20 hover:text-white/40 transition-colors cursor-pointer bg-transparent border-none"
              >
                sign out
              </button>
            </div>
          </div>
        )}

        {stage === "sessions" && (
          <SessionsIsland
            sessions={pastSessions}
            isLoading={isLoadingSessions}
            onResume={handleResumeSession}
            onBack={handleReset}
          />
        )}

        {stage === "loading" && (
          <LoadingIsland
            handle={handle}
            platform={platform}
            step={loadingStep}
            onStepChange={setLoadingStep}
          />
        )}

        {stage === "chat" && profileData && (
          <ChatIsland
            profileData={profileData}
            platform={platform}
            handle={handle}
            messages={messages}
            input={input}
            isSending={isSending}
            ragMode={ragMode}
            onInputChange={setInput}
            onSend={handleSend}
            onReset={handleReset}
            onSignOut={handleSignOut}
            onRagToggle={setRagMode}
          />
        )}

        {error && (
          <div className="font-mono text-xs text-red-400 bg-red-500/8 border border-red-500/20 px-3.5 py-2 rounded-full max-w-130 text-center">
            ⚠ {error}
          </div>
        )}
      </div>

      <p className="fixed bottom-5 font-mono text-[11px] text-white/20 tracking-[0.05em]">
        digital footprint · ai agent
      </p>
    </div>
  );
}