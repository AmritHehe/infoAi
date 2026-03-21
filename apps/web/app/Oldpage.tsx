"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────
type Platform = "X" | "LINKEDIN";
type Stage = "idle" | "loading" | "chat";
type Message = { role: "user" | "assistant"; content: string };

// ── Constants ──────────────────────────────────────────────────────────────
const LOADING_STEPS = [
  { icon: "⟡", text: "Scanning public footprint" },
  { icon: "◈", text: "Extracting profile signals" },
  { icon: "⬡", text: "Spawning AI agent" },
  { icon: "◎", text: "Indexing neural context" },
  { icon: "✦", text: "Calibrating response model" },
];

const API_BASE = "http://localhost:3000";

// Hardcoded for demo — in production, get from auth
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [platform, setPlatform] = useState<Platform>("X");
  const [handle, setHandle] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [loadingStep, setLoadingStep] = useState(0);
  const [profileData, setProfileData] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/auth");
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Animate loading steps
  useEffect(() => {
    if (stage !== "loading") return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 800);
    return () => clearInterval(interval);
  }, [stage]);

   function getUserIdFromToken(): string {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId;
  }
  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExtract = useCallback(async () => {
    if (!handle.trim()) return;
    setStage("loading");
    setLoadingStep(0);
    setError(null);

    try {
      // 1. Extract profile
      const infoRes = await fetch(`${API_BASE}/getUserInfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          platform,
        }),
      });

      
      const infoData = await infoRes.json();
      if (!infoRes.ok) throw new Error(infoData.error ?? "Failed to fetch profile");

      setProfileData(infoData.profile);

      const userId = getUserIdFromToken();
      if (!userId) {
        router.push("/auth"); // redirect to login if no token
        return;
      }
      // 2. Start chat session
      const sessionRes = await fetch(`${API_BASE}/start`, {  // was /chat/start
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: infoData.profile.id,
          userId,
        }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(sessionData.error ?? "Failed to start session");

      setSessionId(sessionData.sessionId);

      // Brief pause so the last loading step reads nicely
      await new Promise((r) => setTimeout(r, 600));
      setStage("chat");
      setMessages([
        {
          role: "assistant",
          content: `I've loaded ${platform === "X" ? "@" : ""}${handle}'s public profile. Ask me anything about them.`,
        },
      ]);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setStage("idle");
    }
  }, [handle, platform]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || !sessionId) return;
    const userMsg = input.trim();
    setInput("");
    setIsSending(true);
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    try {
      // handleSend — fix message URL
      const res = await fetch(`${API_BASE}/message`, {  // was /chat/message
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get reply");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, sessionId]);

  const handleReset = () => {
    setStage("idle");
    setHandle("");
    setProfileData(null);
    setSessionId(null);
    setMessages([]);
    setError(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #080808;
          --surface: #111111;
          --border: rgba(255,255,255,0.07);
          --border-bright: rgba(255,255,255,0.15);
          --text: #f0f0f0;
          --muted: #666;
          --accent: #e8ff47;
          --accent-dim: rgba(232,255,71,0.1);
          --x-color: #f7f7f7;
          --li-color: #0a66c2;
          --radius: 24px;
          --radius-sm: 12px;
        }

        html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; }

        .grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 100; opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 256px;
        }

        .page {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 24px; position: relative;
        }

        /* ── ISLAND ── */
        .island-wrap {
          width: 100%; max-width: 560px;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }

        .island {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 32px 64px rgba(0,0,0,0.6);
          transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .island.idle { padding: 6px 6px 6px 20px; }
        .island.loading { padding: 20px 24px; }
        .island.chat {
          max-width: 720px; width: 100%;
          border-radius: 20px;
          display: flex; flex-direction: column;
          max-height: 72vh;
        }

        /* ── IDLE STATE ── */
        .idle-row {
          display: flex; align-items: center; gap: 12px;
        }

        .idle-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 400;
          color: var(--text); caret-color: var(--accent);
        }
        .idle-input::placeholder { color: var(--muted); }

        .platform-toggle {
          display: flex; align-items: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 4px;
          gap: 2px;
          flex-shrink: 0;
        }

        .toggle-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 999px;
          border: none; cursor: pointer; transition: all 0.2s ease;
          background: transparent; color: var(--muted); font-size: 14px;
        }
        .toggle-btn.active-x { background: var(--x-color); color: #000; }
        .toggle-btn.active-li { background: var(--li-color); color: #fff; }
        .toggle-btn:not(.active-x):not(.active-li):hover { color: var(--text); }

        .go-btn {
          width: 44px; height: 44px; border-radius: 999px; border: none;
          background: var(--accent); color: #000; cursor: pointer;
          font-size: 18px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .go-btn:hover { transform: scale(1.05); }
        .go-btn:active { transform: scale(0.97); }
        .go-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

        /* ── LOADING STATE ── */
        .loading-inner {
          display: flex; flex-direction: column; gap: 16px;
        }

        .loading-top {
          display: flex; align-items: center; gap: 14px;
        }

        .loading-icon {
          width: 40px; height: 40px; border-radius: 50%;
          border: 1.5px solid var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; color: var(--accent);
          animation: spin-slow 3s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .loading-texts { flex: 1; }
        .loading-handle {
          font-size: 13px; color: var(--muted); font-family: 'JetBrains Mono', monospace;
          margin-bottom: 4px;
        }
        .loading-step {
          font-size: 14px; font-weight: 600; color: var(--text);
          transition: opacity 0.3s ease;
        }

        .loading-bar-track {
          height: 2px; background: var(--border); border-radius: 999px; overflow: hidden;
        }
        .loading-bar-fill {
          height: 100%; background: var(--accent); border-radius: 999px;
          animation: indeterminate 1.4s ease-in-out infinite;
          transform-origin: left;
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%) scaleX(0.4); }
          50% { transform: translateX(0%) scaleX(0.6); }
          100% { transform: translateX(200%) scaleX(0.4); }
        }

        /* ── CHAT STATE ── */
        .chat-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 12px;
          flex-shrink: 0;
        }

        .chat-avatar {
          width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
          flex-shrink: 0; background: var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700;
        }
        .chat-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .chat-meta { flex: 1; min-width: 0; }
        .chat-name {
          font-size: 14px; font-weight: 700; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .chat-sub {
          font-size: 11px; color: var(--muted); font-family: 'JetBrains Mono', monospace;
          margin-top: 1px;
        }

        .platform-badge {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          padding: 3px 8px; border-radius: 999px; font-weight: 500; flex-shrink: 0;
        }
        .platform-badge.x { background: rgba(247,247,247,0.1); color: var(--x-color); }
        .platform-badge.li { background: rgba(10,102,194,0.15); color: #4d9de0; }

        .reset-btn {
          width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border);
          background: transparent; color: var(--muted); cursor: pointer; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease; flex-shrink: 0;
        }
        .reset-btn:hover { border-color: var(--border-bright); color: var(--text); }

        .chat-messages {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        .msg {
          display: flex; gap: 10px;
          animation: msg-in 0.25s ease forwards;
        }
        .msg.user { flex-direction: row-reverse; }

        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .msg-dot {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 11px;
          margin-top: 2px;
        }
        .msg.assistant .msg-dot { background: var(--accent-dim); color: var(--accent); border: 1px solid rgba(232,255,71,0.2); }
        .msg.user .msg-dot { background: rgba(255,255,255,0.08); color: var(--muted); }

        .msg-bubble {
          max-width: 78%; padding: 10px 14px; border-radius: 16px;
          font-size: 13.5px; line-height: 1.6; font-family: 'JetBrains Mono', monospace;
          font-weight: 400;
        }
        .msg.assistant .msg-bubble {
          background: rgba(255,255,255,0.04); border: 1px solid var(--border);
          border-top-left-radius: 4px; color: var(--text);
        }
        .msg.user .msg-bubble {
          background: var(--accent); color: #000; font-weight: 500;
          border-top-right-radius: 4px;
        }

        .typing-dots {
          display: flex; gap: 4px; align-items: center; padding: 4px 0;
        }
        .typing-dots span {
          width: 5px; height: 5px; border-radius: 50%; background: var(--muted);
          animation: bounce 1.2s infinite ease;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }

        .chat-input-row {
          padding: 12px 14px;
          border-top: 1px solid var(--border);
          display: flex; gap: 8px; align-items: center;
          flex-shrink: 0;
        }

        .chat-input {
          flex: 1; background: rgba(255,255,255,0.04);
          border: 1px solid var(--border); border-radius: var(--radius-sm);
          padding: 10px 14px; font-family: 'JetBrains Mono', monospace;
          font-size: 13px; color: var(--text); outline: none;
          transition: border-color 0.15s ease;
        }
        .chat-input:focus { border-color: var(--border-bright); }
        .chat-input::placeholder { color: var(--muted); }

        .send-btn {
          width: 38px; height: 38px; border-radius: var(--radius-sm);
          border: none; background: var(--accent); color: #000;
          cursor: pointer; font-size: 15px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .send-btn:hover { transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

        /* ── ERROR ── */
        .error-pill {
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          color: #ff6b6b; background: rgba(255,107,107,0.08);
          border: 1px solid rgba(255,107,107,0.2);
          padding: 8px 14px; border-radius: 999px;
          max-width: 520px; text-align: center;
        }

        /* ── FOOTER ── */
        .footer {
          position: fixed; bottom: 20px;
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted);
          letter-spacing: 0.05em;
        }

        /* ── SUGGESTIONS ── */
        .suggestions {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 0 16px 12px;
          flex-shrink: 0;
        }
        .suggestion-chip {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: var(--muted); background: transparent;
          border: 1px solid var(--border); border-radius: 999px;
          padding: 5px 11px; cursor: pointer;
          transition: all 0.15s ease;
        }
        .suggestion-chip:hover {
          color: var(--text); border-color: var(--border-bright);
          background: rgba(255,255,255,0.04);
        }

        /* ── ISLAND EXPAND ANIMATION ── */
        .island-wrap.chat-mode {
          max-width: 720px;
        }
      `}</style>

      <div className="grain" />

      <main className="page">
        <div className={`island-wrap ${stage === "chat" ? "chat-mode" : ""}`}>

          {/* ── IDLE ── */}
          {stage === "idle" && (
            <div className="island idle">
              <div className="idle-row">
                <input
                  ref={inputRef}
                  className="idle-input"
                  placeholder={platform === "X" ? "enter x handle..." : "linkedin.com/in/..."}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                  autoFocus
                />
                <div className="platform-toggle">
                  <button
                    className={`toggle-btn ${platform === "X" ? "active-x" : ""}`}
                    onClick={() => setPlatform("X")}
                    title="X / Twitter"
                  >
                    𝕏
                  </button>
                  <button
                    className={`toggle-btn ${platform === "LINKEDIN" ? "active-li" : ""}`}
                    onClick={() => setPlatform("LINKEDIN")}
                    title="LinkedIn"
                  >
                    in
                  </button>
                </div>
                <button className="go-btn" onClick={handleExtract} disabled={!handle.trim()}>
                  →
                </button>
              </div>
            </div>
          )}

          {/* ── LOADING ── */}
          {stage === "loading" && (
            <div className="island loading">
              <div className="loading-inner">
                <div className="loading-top">
                  <div className="loading-icon">
                    {LOADING_STEPS[loadingStep].icon}
                  </div>
                  <div className="loading-texts">
                    <div className="loading-handle">
                      {platform === "X" ? "@" : ""}{handle}
                    </div>
                    <div className="loading-step">
                      {LOADING_STEPS[loadingStep].text}...
                    </div>
                  </div>
                </div>
                <div className="loading-bar-track">
                  <div className="loading-bar-fill" />
                </div>
              </div>
            </div>
          )}

          {/* ── CHAT ── */}
          {stage === "chat" && profileData && (
            <div className="island chat">
              {/* Header */}
              <div className="chat-header">
                <div className="chat-avatar">
                  {profileData.Data?.profileImageUrl ? (
                    <img src={profileData.Data.profileImageUrl} alt="" />
                  ) : (
                    (profileData.Data?.name ?? handle)[0]?.toUpperCase()
                  )}
                </div>
                <div className="chat-meta">
                  <div className="chat-name">
                    {profileData.Data?.name ?? handle}
                  </div>
                  <div className="chat-sub">
                    {platform === "X"
                      ? `@${profileData.Data?.username ?? handle} · ${(profileData.Data?.followersCount ?? 0).toLocaleString()} followers`
                      : profileData.Data?.currentRole ?? profileData.Data?.headline ?? ""}
                  </div>
                </div>
                <span className={`platform-badge ${platform === "X" ? "x" : "li"}`}>
                  {platform === "X" ? "𝕏 twitter" : "in linkedin"}
                </span>
                <button className="reset-btn" onClick={handleReset} title="New search">✕</button>
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`msg ${msg.role}`}>
                    <div className="msg-dot">
                      {msg.role === "assistant" ? "✦" : "◎"}
                    </div>
                    <div className="msg-bubble">{msg.content}</div>
                  </div>
                ))}
                {isSending && (
                  <div className="msg assistant">
                    <div className="msg-dot">✦</div>
                    <div className="msg-bubble">
                      <div className="typing-dots">
                        <span /><span /><span />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Suggestions (shown when only 1 message) */}
              {messages.length === 1 && (
                <div className="suggestions">
                  {(platform === "X"
                    ? ["What does this person tweet about?", "Their most engaging tweet?", "Give me a summary", "How influential are they?"]
                    : ["What's their career background?", "What skills do they have?", "Where did they study?", "Summarize their profile"]
                  ).map((q) => (
                    <button key={q} className="suggestion-chip" onClick={() => { setInput(q); }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  placeholder="ask anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  autoFocus
                />
                <button className="send-btn" onClick={handleSend} disabled={isSending || !input.trim()}>
                  ↑
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {error && <div className="error-pill">⚠ {error}</div>}
        </div>

        <div className="footer">digital footprint · ai agent</div>
      </main>
    </>
  );
}