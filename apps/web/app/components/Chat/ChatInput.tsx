"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: Props) {
  return (
    <div className="flex items-center gap-2 p-3 border-t border-white/7 shrink-0">
      <input
        className="flex-1 bg-white/4 border border-white/7 rounded-xl px-3.5 py-2.5 font-mono text-[13px] text-[#f0f0f0] outline-none placeholder:text-white/20 focus:border-white/15 transition-colors disabled:opacity-40"
        placeholder="ask anything..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        autoFocus
        disabled={disabled}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="w-10 h-10 rounded-xl bg-[#e8ff47] text-black text-base flex items-center justify-center shrink-0 border-none cursor-pointer transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        ↑
      </button>
    </div>
  );
}