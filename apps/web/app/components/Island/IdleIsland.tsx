"use client";

import { Platform } from "../../types";

interface Props {
  handle: string;
  onHandleChange: (v: string) => void;
  onSubmit: () => void;
  error?: string | null;
}

export default function IdleIsland({
  handle, onHandleChange, onSubmit, error
}: Props) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="w-full bg-[#111] border border-white/7 rounded-[24px] overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_32px_64px_rgba(0,0,0,0.6)] pl-5 pr-1.5 py-1.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_32px_64px_rgba(0,0,0,0.6)] transition-all">
        <div className="flex items-center gap-3">
          <input
            className="flex-1 bg-transparent border-none outline-none font-mono text-[14px] text-[#f0f0f0] placeholder:text-white/20 caret-accent"
            placeholder="enter an x handle or linkedin url..."
            value={handle}
            onChange={(e) => onHandleChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            autoFocus
            spellCheck={false}
          />
          <button
            onClick={onSubmit}
            disabled={!handle.trim()}
            className="w-11 h-11 rounded-full bg-accent text-black text-lg flex items-center justify-center shrink-0 border-none cursor-pointer transition-all duration-150 hover:scale-105 active:scale-97 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            →
          </button>
        </div>
      </div>
      
      {error && (
        <div className="w-full text-center px-4 py-3 bg-[rgba(255,50,50,0.05)] border border-[rgba(255,50,50,0.1)] rounded-[16px] text-[#ff6b6b] text-[13px] font-mono leading-relaxed animate-fade-up">
          {error}
        </div>
      )}
    </div>
  );
}