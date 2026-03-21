"use client";

import { Platform } from "../../types";

interface Props {
  handle: string;
  platform: Platform;
  onHandleChange: (v: string) => void;
  onPlatformChange: (p: Platform) => void;
  onSubmit: () => void;
}

export default function IdleIsland({
  handle, platform, onHandleChange, onPlatformChange, onSubmit,
}: Props) {
  return (
    <div className="w-full bg-[#111] border border-white/7 rounded-3xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_32px_64px_rgba(0,0,0,0.6)] pl-5 pr-1.5 py-1.5">
      <div className="flex items-center gap-3">
        {/* Text input */}
        <input
          className="flex-1 bg-transparent border-none outline-none font-mono text-[15px] text-[#f0f0f0] placeholder:text-white/20 caret-[#e8ff47]"
          placeholder={platform === "X" ? "enter x handle..." : "linkedin.com/in/..."}
          value={handle}
          onChange={(e) => onHandleChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          autoFocus
        />

        {/* Platform toggle */}
        <div className="flex items-center bg-white/4 border border-white/7 rounded-full p-1 gap-0.5 shrink-0">
          <button
            onClick={() => onPlatformChange("X")}
            title="X / Twitter"
            className={`
              w-8 h-8 rounded-full text-sm flex items-center justify-center
              transition-all duration-200 border-none cursor-pointer
              ${platform === "X"
                ? "bg-[#f7f7f7] text-black"
                : "bg-transparent text-white/30 hover:text-white/60"
              }
            `}
          >
            𝕏
          </button>
          <button
            onClick={() => onPlatformChange("LINKEDIN")}
            title="LinkedIn"
            className={`
              w-8 h-8 rounded-full text-sm flex items-center justify-center
              transition-all duration-200 border-none cursor-pointer
              ${platform === "LINKEDIN"
                ? "bg-[#0a66c2] text-white"
                : "bg-transparent text-white/30 hover:text-white/60"
              }
            `}
          >
            in
          </button>
        </div>

        {/* Go button */}
        <button
          onClick={onSubmit}
          disabled={!handle.trim()}
          className="w-11 h-11 rounded-full bg-[#e8ff47] text-black text-lg flex items-center justify-center shrink-0 border-none cursor-pointer transition-all duration-150 hover:scale-105 active:scale-97 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          →
        </button>
      </div>
    </div>
  );
}