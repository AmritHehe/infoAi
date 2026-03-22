"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "./hooks/useChat";
import { isAuthenticated, clearToken } from "./hooks/useAuth";
import LoadingIsland from "./components/Island/LoadingIsland";
import ChatIsland from "./components/Island/ChatIsland";
import IdleIsland from "./components/Island/IdleIsland";
import SessionsIsland from "./components/Island/SessionsIsland";

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

  // Render nothing until hydration + auth check finishes
  if (!hydrated || !authed) return null;

  return (
    <div className="min-h-screen bg-bg text-[#f0f0f0] font-['Syne',sans-serif] flex flex-col items-center justify-center p-6 relative">

      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-100 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* Grid background */}
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

        {/* IDLE */}
        {stage === "idle" && (
          <>
            <IdleIsland
              handle={handle}
              platform={platform}
              onHandleChange={setHandle}
              onPlatformChange={setPlatform}
              onSubmit={handleExtract}
            />
            <div className="flex items-center gap-4">
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
          </>
        )}

        {/* SESSIONS */}
        {stage === "sessions" && (
          <SessionsIsland
            sessions={pastSessions}
            isLoading={isLoadingSessions}
            onResume={handleResumeSession}
            onBack={handleReset}
          />
        )}

        {/* LOADING */}
        {stage === "loading" && (
          <LoadingIsland
            handle={handle}
            platform={platform}
            step={loadingStep}
            onStepChange={setLoadingStep}
          />
        )}

        {/* CHAT */}
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

        {/* Error pill */}
        {error && (
          <div className="font-mono text-xs text-red-400 bg-red-500/8 border border-red-500/20 px-3.5 py-2 rounded-full max-w-130 text-center">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="fixed bottom-5 font-mono text-[11px] text-white/20 tracking-[0.05em]">
        digital footprint · ai agent
      </p>
    </div>
  );
}