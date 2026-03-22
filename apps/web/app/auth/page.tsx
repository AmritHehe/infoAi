"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://api-infoai.amrithehe.com";

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
        const signinRes = await fetch(`${API_BASE}/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const signinData = await signinRes.json();
        if (!signinRes.ok) throw new Error(signinData.message ?? "Sign in failed.");
        localStorage.setItem("token", signinData.data.token);
        localStorage.setItem("email", email);
        router.push("/");
      } else {
        localStorage.setItem("token", data.data.token);
        localStorage.setItem("email", email);
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message ?? "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-[#f0f0f0] font-['Syne',sans-serif] flex flex-col items-center justify-center p-6 relative">
      <div
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03]"
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

      <main className="relative z-10 w-full max-w-[400px] flex flex-col items-center animate-fade-up">

        <div className="flex flex-col items-center text-center gap-1.5 mb-8">
          <h1 className="text-[28px] font-bold tracking-tight text-[#f0f0f0]">
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="text-[14px] text-white/40">
            {mode === "signin"
              ? "Sign in to your account to continue"
              : "Enter your details to get started"}
          </p>
        </div>

        <div className="w-full bg-[#111] border border-white/7 rounded-[20px] overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_40px_80px_rgba(0,0,0,0.5),0_0_80px_rgba(232,255,71,0.02)]">
          <div className="flex border-b border-white/7">
            <button
              className={`flex-1 p-4 bg-transparent border-none cursor-pointer font-mono text-xs font-medium tracking-[0.06em] uppercase transition-all relative ${mode === "signin" ? "text-[#f0f0f0]" : "text-white/40 hover:text-white/60"}`}
              onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}
            >
              Sign In
              {mode === "signin" && <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-accent" />}
            </button>
            <button
              className={`flex-1 p-4 bg-transparent border-none cursor-pointer font-mono text-xs font-medium tracking-[0.06em] uppercase transition-all relative ${mode === "signup" ? "text-[#f0f0f0]" : "text-white/40 hover:text-white/60"}`}
              onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}
            >
              Sign Up
              {mode === "signup" && <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-accent" />}
            </button>
          </div>

          <div className="flex flex-col gap-3.5 px-6 py-7">
            <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${mode === "signup" ? "max-h-[80px] opacity-100" : "max-h-0 opacity-0 pointer-events-none mb-[-14px]"}`}>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-white/40">Name</label>
                <input
                  className="w-full bg-[#161616] border border-white/7 rounded-[10px] px-3.5 py-[11px] font-mono text-[13px] text-[#f0f0f0] outline-none transition-colors focus:border-white/15 focus:bg-[rgba(255,255,255,0.03)] placeholder:text-white/30"
                  type="text"
                  placeholder="your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-white/40">Email</label>
              <input
                className="w-full bg-[#161616] border border-white/7 rounded-[10px] px-3.5 py-[11px] font-mono text-[13px] text-[#f0f0f0] outline-none transition-colors focus:border-white/15 focus:bg-[rgba(255,255,255,0.03)] placeholder:text-white/30"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-white/40">Password</label>
              <input
                className="w-full bg-[#161616] border border-white/7 rounded-[10px] px-3.5 py-[11px] font-mono text-[13px] text-[#f0f0f0] outline-none transition-colors focus:border-white/15 focus:bg-[rgba(255,255,255,0.03)] placeholder:text-white/30"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <button
              className="mt-1 w-full p-[13px] bg-accent text-black border-none rounded-[10px] cursor-pointer font-['Syne',sans-serif] text-[14px] font-bold tracking-[0.02em] transition-all flex items-center justify-center gap-2 hover:not-disabled:-translate-y-[1px] hover:not-disabled:shadow-[0_8px_24px_rgba(232,255,71,0.2)] active:not-disabled:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={loading || !email || !password || (mode === "signup" && !name)}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[rgba(0,0,0,0.3)] border-t-black rounded-full animate-spin" />
                  {mode === "signup" ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                mode === "signup" ? "Create Account →" : "Sign In →"
              )}
            </button>
          </div>

          {error && (
            <div className="mx-6 mb-5 px-3.5 py-2.5 rounded-[10px] font-mono text-xs bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.2)] text-[#ff6b6b] animate-fade-up">
              ⚠ {error}
            </div>
          )}
          {success && (
            <div className="mx-6 mb-5 px-3.5 py-2.5 rounded-[10px] font-mono text-xs bg-[rgba(107,255,184,0.08)] border border-[rgba(107,255,184,0.2)] text-[#6bffb8] animate-fade-up">
              ✓ {success}
            </div>
          )}
        </div>

        <div className="mt-7 font-mono text-[11px] text-white/40 tracking-[0.05em] text-center opacity-0 animate-[fade-in_0.6s_ease_0.2s_forwards]">
          all data sourced from public profiles only
        </div>
      </main>
    </div>
  );
}