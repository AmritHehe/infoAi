"use client";

import { useEffect } from "react";
import { Platform } from "../../types";

const STEPS = [
  { icon: "⟡", text: "Scanning public footprint" },
  { icon: "◈", text: "Extracting profile signals" },
  { icon: "⬡", text: "Spawning AI agent" },
  { icon: "◎", text: "Indexing neural context" },
  { icon: "✦", text: "Calibrating response model" },
];

interface Props {
  handle: string;
  platform: Platform;
  step: number;
  onStepChange: (s: number) => void;
}

export default function LoadingIsland({ handle, platform, step, onStepChange }: Props) {
  useEffect(() => {
    const interval = setInterval(() => {
      onStepChange((step + 1) % STEPS.length);
    }, 800);
    return () => clearInterval(interval);
  }, [step]);

  return (
    <div className="w-full bg-[#111] border border-white/7 rounded-3xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_32px_64px_rgba(0,0,0,0.6)] p-5">
      <div className="flex flex-col gap-4">
        {/* Top row */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full border border-accent flex items-center justify-center text-base text-accent shrink-0 animate-spin [animation-duration:3s]">
            {STEPS[step].icon}
          </div>
          <div className="flex-1">
            <p className="font-mono text-[13px] text-white/30 mb-1">
              {platform === "X" ? "@" : ""}{handle}
            </p>
            <p className="font-semibold text-sm text-[#f0f0f0]">
              {STEPS[step].text}...
            </p>
          </div>
        </div>


        <div className="h-px bg-white/7 rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full animate-indeterminate origin-left" />
        </div>
      </div>
    </div>
  );
}