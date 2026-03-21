"use client";

import { useState, useEffect } from "react";
import { useChat } from "./hooks/useChat";
import { isAuthenticated, clearToken } from "./hooks/useAuth";
import AuthModal from "./components/AuthModal";
import IdleIsland from "./components/Island/IdleIsland";
import LoadingIsland from "./components/Island/LoadingIsland";
import ChatIsland from "./components/Island/ChatIsland";

export default function HomePage() {
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Wait for localStorage to be available
  useEffect(() => {
    setAuthed(isAuthenticated());
    setHydrated(true);
  }, []);

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
    handleExtract,
    handleSend,
    handleReset,
  } = useChat();

  const handleSignOut = () => {
    clearToken();
    setAuthed(false);
    handleReset();
  };

  // Avoid hydration mismatch
  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f0f0f0] font-['Syne',sans-serif] flex flex-col items-center justify-center p-6 relative">

      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.025]"
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

      {/* ── NOT AUTHENTICATED — show auth modal ── */}
      {!authed && (
        <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-[fade-up_0.5s_ease_forwards]">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 border border-[#e8ff47] rounded-lg flex items-center justify-center font-mono text-sm text-[#e8ff47]">
              ⟡
            </div>
            <span className="font-mono text-[13px] font-semibold tracking-widest uppercase text-white/40">
              Digital Footprint
            </span>
          </div>

          <AuthModal onSuccess={() => setAuthed(true)} />
        </div>
      )}

      {/* ── AUTHENTICATED — show main app ── */}
      {authed && (
        <div className={`
          w-full flex flex-col items-center gap-4
          transition-all duration-500
          ${stage === "chat" ? "max-w-2xl" : "max-w-[560px]"}
        `}>
          {stage === "idle" && (
            <IdleIsland
              handle={handle}
              platform={platform}
              onHandleChange={setHandle}
              onPlatformChange={setPlatform}
              onSubmit={handleExtract}
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
            <div className="font-mono text-xs text-red-400 bg-red-500/8 border border-red-500/20 px-3.5 py-2 rounded-full max-w-[520px] text-center">
              ⚠ {error}
            </div>
          )}

          {/* Sign out link on idle */}
          {stage === "idle" && (
            <button
              onClick={handleSignOut}
              className="font-mono text-[11px] text-white/20 hover:text-white/40 transition-colors cursor-pointer bg-transparent border-none"
            >
              sign out
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="fixed bottom-5 font-mono text-[11px] text-white/20 tracking-[0.05em]">
        digital footprint · ai agent
      </p>
    </div>
  );
}