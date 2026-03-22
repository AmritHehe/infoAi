"use client";

import { useState, useEffect } from "react";
import { indexProfile, getRagStatus } from "../lib/api";

interface Props {
  profileId: string;
  ragMode: boolean;
  onToggle: (enabled: boolean) => void;
}

type IndexState = "idle" | "checking" | "indexing" | "indexed" | "error";

export default function RagToggle({ profileId, ragMode, onToggle }: Props) {
  const [indexState, setIndexState] = useState<IndexState>("checking");
  const [chunksCount, setChunksCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check if already indexed on mount
  useEffect(() => {
    checkStatus();
  }, [profileId]);

  const checkStatus = async () => {
    setIndexState("checking");
    try {
      const status = await getRagStatus(profileId);
      if (status.indexed) {
        setChunksCount(status.chunksCount);
        setIndexState("indexed");
      } else {
        setIndexState("idle");
      }
    } catch {
      setIndexState("idle");
    }
  };

  const handleIndex = async () => {
    setIndexState("indexing");
    setError(null);
    try {
      const result = await indexProfile(profileId);
      setChunksCount(result.chunksIndexed);
      setIndexState("indexed");
    } catch (err: any) {
      setError(err.message ?? "Indexing failed");
      setIndexState("error");
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/7 shrink-0 bg-white/2">

      {/* Left — index status + button */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {indexState === "checking" && (
          <span className="font-mono text-[11px] text-white/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
            checking index...
          </span>
        )}

        {indexState === "idle" && (
          <button
            onClick={handleIndex}
            className="font-mono text-[11px] text-accent/70 border border-accent/20` bg-accent/5 px-2.5 py-1 rounded-full hover:bg-accent/10 hover:text-accent transition-all cursor-pointer"
          >
            ⬡ index for RAG
          </button>
        )}

        {indexState === "indexing" && (
          <span className="font-mono text-[11px] text-accent/60 flex items-center gap-1.5">
            <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
            indexing chunks...
          </span>
        )}

        {indexState === "indexed" && (
          <span className="font-mono text-[11px] text-white/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {chunksCount} chunks indexed
            <button
              onClick={handleIndex}
              className="text-white/20 hover:text-white/40 transition-colors ml-1"
              title="Re-index"
            >
              ↺
            </button>
          </span>
        )}

        {indexState === "error" && (
          <span className="font-mono text-[11px] text-red-400 flex items-center gap-1.5">
            ⚠ {error}
            <button onClick={handleIndex} className="text-white/30 hover:text-white/60 ml-1">
              retry
            </button>
          </span>
        )}
      </div>

      {/* Right — RAG mode toggle (only when indexed) */}
      {indexState === "indexed" && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest">
            RAG
          </span>
          <button
            onClick={() => onToggle(!ragMode)}
            className={`
              relative w-9 h-5 rounded-full border transition-all duration-200 cursor-pointer
              ${ragMode
                ? "bg-accent border-accent"
                : "bg-transparent border-white/15"
              }
            `}
          >
            <span className={`
              absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200
              ${ragMode
                ? "left-4.5 bg-black"
                : "left-0.5 bg-white/30"
              }
            `} />
          </button>
        </div>
      )}
    </div>
  );
}