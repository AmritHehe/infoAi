"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:3000";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !name)) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const body =
        mode === "signup"
          ? { name, email, password }
          : { email, password };

      const res = await fetch(`${API_BASE}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message ?? "Something went wrong.");
      }

      if (mode === "signup") {
        setSuccess("Account created! Signing you in...");
        // Auto sign in after signup
        const signinRes = await fetch(`${API_BASE}/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const signinData = await signinRes.json();
        if (!signinRes.ok) throw new Error(signinData.message ?? "Sign in failed.");
        localStorage.setItem("token", signinData.data.token);
        localStorage.setItem("email", email);
        router.push("/home");
      } else {
        localStorage.setItem("token", data.data.token);
        localStorage.setItem("email", email);
        router.push("/home");
      }
    } catch (err: any) {
      setError(err.message ?? "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #080808;
          --surface: #111111;
          --surface2: #161616;
          --border: rgba(255,255,255,0.07);
          --border-bright: rgba(255,255,255,0.15);
          --text: #f0f0f0;
          --muted: #555;
          --muted2: #888;
          --accent: #e8ff47;
          --accent-dim: rgba(232,255,71,0.08);
          --error: #ff6b6b;
          --success: #6bffb8;
          --radius: 20px;
        }

        html, body {
          height: 100%;
          background: var(--bg);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          overflow: hidden;
        }

        /* ── GRAIN ── */
        .grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 100; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 256px;
        }

        /* ── GRID BG ── */
        .grid-bg {
          position: fixed; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        /* ── GLOW ── */
        .glow {
          position: fixed; pointer-events: none;
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(232,255,71,0.04) 0%, transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%, -60%);
        }

        /* ── PAGE ── */
        .page {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 24px; position: relative;
        }

        /* ── LOGO ── */
        .logo {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 40px;
          animation: fade-up 0.6s ease forwards;
        }
        .logo-mark {
          width: 32px; height: 32px;
          border: 1.5px solid var(--accent);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; color: var(--accent);
          font-family: 'JetBrains Mono', monospace;
        }
        .logo-text {
          font-size: 13px; font-weight: 600; letter-spacing: 0.08em;
          color: var(--muted2); text-transform: uppercase;
          font-family: 'JetBrains Mono', monospace;
        }

        /* ── CARD ── */
        .card {
          width: 100%; max-width: 400px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.5),
            0 40px 80px rgba(0,0,0,0.5),
            0 0 80px rgba(232,255,71,0.02);
          animation: fade-up 0.6s ease 0.1s both;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── TAB SWITCHER ── */
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
        }
        .tab {
          flex: 1; padding: 16px;
          background: transparent; border: none; cursor: pointer;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--muted); transition: all 0.2s ease;
          position: relative;
        }
        .tab.active { color: var(--text); }
        .tab.active::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
          height: 1px; background: var(--accent);
        }
        .tab:hover:not(.active) { color: var(--muted2); }

        /* ── FORM ── */
        .form { padding: 28px 24px; display: flex; flex-direction: column; gap: 14px; }

        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label {
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--muted);
        }
        .field-input {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 11px 14px;
          font-family: 'JetBrains Mono', monospace; font-size: 13px;
          color: var(--text); outline: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .field-input:focus {
          border-color: var(--border-bright);
          background: rgba(255,255,255,0.03);
        }
        .field-input::placeholder { color: var(--muted); }

        /* ── SUBMIT BTN ── */
        .submit-btn {
          margin-top: 4px;
          width: 100%; padding: 13px;
          background: var(--accent); color: #000;
          border: none; border-radius: 10px; cursor: pointer;
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.02em;
          transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(232,255,71,0.2);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── SPINNER ── */
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(0,0,0,0.3);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── FEEDBACK ── */
        .feedback {
          margin: 0 24px 20px;
          padding: 10px 14px; border-radius: 10px;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          animation: fade-up 0.3s ease;
        }
        .feedback.error {
          background: rgba(255,107,107,0.08);
          border: 1px solid rgba(255,107,107,0.2);
          color: var(--error);
        }
        .feedback.success {
          background: rgba(107,255,184,0.08);
          border: 1px solid rgba(107,255,184,0.2);
          color: var(--success);
        }

        /* ── DIVIDER ── */
        .divider {
          display: flex; align-items: center; gap: 12px;
          margin: 2px 0;
        }
        .divider-line { flex: 1; height: 1px; background: var(--border); }
        .divider-text {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted);
        }

        /* ── FOOTER ── */
        .footer {
          margin-top: 28px;
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted);
          letter-spacing: 0.05em; text-align: center;
          animation: fade-up 0.6s ease 0.2s both;
        }

        /* ── NAME FIELD SLIDE ── */
        .name-field {
          overflow: hidden;
          transition: max-height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
        }
        .name-field.visible { max-height: 80px; opacity: 1; }
        .name-field.hidden { max-height: 0; opacity: 0; pointer-events: none; }
      `}</style>

      <div className="grain" />
      <div className="grid-bg" />
      <div className="glow" />

      <main className="page">
        {/* Logo */}
        <div className="logo">
          <div className="logo-mark">⟡</div>
          <div className="logo-text">Digital Footprint</div>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${mode === "signin" ? "active" : ""}`}
              onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}
            >
              Sign In
            </button>
            <button
              className={`tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <div className="form">
            {/* Name — only signup */}
            <div className={`name-field ${mode === "signup" ? "visible" : "hidden"}`}>
              <div className="field">
                <label className="field-label">Name</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={loading || !email || !password || (mode === "signup" && !name)}
            >
              {loading ? (
                <><div className="spinner" /> {mode === "signup" ? "Creating account..." : "Signing in..."}</>
              ) : (
                mode === "signup" ? "Create Account →" : "Sign In →"
              )}
            </button>
          </div>

          {/* Feedback */}
          {error && <div className="feedback error">⚠ {error}</div>}
          {success && <div className="feedback success">✓ {success}</div>}
        </div>

        <div className="footer">
          all data sourced from public profiles only
        </div>
      </main>
    </>
  );
}