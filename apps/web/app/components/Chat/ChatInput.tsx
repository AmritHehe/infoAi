"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  ragMode: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled, ragMode }: Props) {
  return (
    <div className="flex items-center gap-2 p-3 border-t border-white/7 shrink-0">
      <div className="flex-1 relative">
        <input
          className={`
            w-full bg-white/4 border rounded-xl px-3.5 py-2.5 font-mono text-[13px]
            text-[#f0f0f0] outline-none placeholder:text-white/20 transition-colors
            disabled:opacity-40
            ${ragMode
              ? "border-[#e8ff47]/20 focus:border-[#e8ff47]/40"
              : "border-white/7 focus:border-white/15"
            }
          `}
          placeholder={ragMode ? "ask with RAG..." : "ask anything..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          autoFocus
          disabled={disabled}
        />
        {/* RAG indicator inside input */}
        {ragMode && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[#e8ff47]/40 uppercase tracking-widest pointer-events-none">
            rag
          </span>
        )}
      </div>

      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className={`
          w-10 h-10 rounded-xl text-base flex items-center justify-center
          shrink-0 border-none cursor-pointer transition-all
          hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100
          ${ragMode
            ? "bg-[#e8ff47] text-black shadow-[0_0_12px_rgba(232,255,71,0.3)]"
            : "bg-[#e8ff47] text-black"
          }
        `}
      >
        ↑
      </button>
    </div>
  );
}