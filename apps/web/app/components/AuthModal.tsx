"use client";

import { useState } from "react";
import { signIn, signUp } from "../lib/api";
import { saveToken } from "../hooks/useAuth";

interface Props {
  onSuccess: () => void;
}

type Mode = "signin" | "signup";

export default function AuthModal({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !name)) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        await signUp(name, email, password);
        // auto sign in after signup
        const token = await signIn(email, password);
        saveToken(token);
      } else {
        const token = await signIn(email, password);
        saveToken(token);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Card */}
      <div className="bg-[#111] border border-white/7 rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_32px_64px_rgba(0,0,0,0.6)]">

        {/* Tab switcher */}
        <div className="flex border-b border-white/7">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`
                flex-1 py-3.5 text-xs font-mono font-medium tracking-widest uppercase
                transition-colors duration-150 relative
                ${mode === m ? "text-[#f0f0f0]" : "text-white/30 hover:text-white/50"}
              `}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
              {mode === m && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-[#e8ff47]" />
              )}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3.5 p-6">

          {/* Name — signup only */}
          <div
            className={`
              overflow-hidden transition-all duration-300
              ${mode === "signup" ? "max-h-24 opacity-100" : "max-h-0 opacity-0 pointer-events-none"}
            `}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono font-medium tracking-widest uppercase text-white/30">
                Name
              </label>
              <input
                type="text"
                placeholder="your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/4 border border-white/7 rounded-xl px-3.5 py-2.5 font-mono text-[13px] text-[#f0f0f0] outline-none placeholder:text-white/20 focus:border-white/15 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-medium tracking-widest uppercase text-white/30">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="bg-white/4 border border-white/7 rounded-xl px-3.5 py-2.5 font-mono text-[13px] text-[#f0f0f0] outline-none placeholder:text-white/20 focus:border-white/15 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-medium tracking-widest uppercase text-white/30">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="bg-white/4 border border-white/7 rounded-xl px-3.5 py-2.5 font-mono text-[13px] text-[#f0f0f0] outline-none placeholder:text-white/20 focus:border-white/15 transition-colors"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password || (mode === "signup" && !name)}
            className="mt-1 w-full py-3 bg-[#e8ff47] text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(232,255,71,0.2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                {mode === "signup" ? "Creating..." : "Signing in..."}
              </>
            ) : (
              mode === "signup" ? "Create Account →" : "Sign In →"
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-5 px-3.5 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl font-mono text-xs text-red-400">
            ⚠ {error}
          </div>
        )}
      </div>

      <p className="mt-4 text-center font-mono text-[11px] text-white/20">
        all data sourced from public profiles only
      </p>
    </div>
  );
}