"use client";

import { useEffect, useRef } from "react";
import { Message, Platform } from "../../types";

const SUGGESTIONS: Record<Platform, string[]> = {
  X: ["What does this person tweet about?", "Most engaging tweet?", "Give me a summary", "How influential are they?"],
  LINKEDIN: ["What's their career background?", "What skills do they have?", "Where did they study?", "Summarize their profile"],
};

interface Props {
  messages: Message[];
  isSending: boolean;
  platform: Platform;
  onSuggestion: (q: string) => void;
}

export default function ChatMessages({ messages, isSending, platform, onSuggestion }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-white/7 scrollbar-track-transparent">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 animate-[msg-in_0.25s_ease_forwards] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Dot */}
            <div className={`
              w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] mt-0.5
              ${msg.role === "assistant"
                ? "bg-[rgba(232,255,71,0.1)] text-[#e8ff47] border border-[rgba(232,255,71,0.2)]"
                : "bg-white/8 text-white/30"
              }
            `}>
              {msg.role === "assistant" ? "✦" : "◎"}
            </div>

            {/* Bubble */}
            <div className={`
              max-w-[78%] px-3.5 py-2.5 rounded-2xl font-mono text-[13px] leading-relaxed
              ${msg.role === "assistant"
                ? "bg-white/4 border border-white/7 rounded-tl-sm text-[#f0f0f0]"
                : "bg-[#e8ff47] text-black font-medium rounded-tr-sm"
              }
            `}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isSending && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full shrink-0 bg-[rgba(232,255,71,0.1)] text-[#e8ff47] border border-[rgba(232,255,71,0.2)] flex items-center justify-center text-[11px]">
              ✦
            </div>
            <div className="px-3.5 py-3 bg-white/4 border border-white/7 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center">
                {[0, 200, 400].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions — only on first message */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 shrink-0">
          {SUGGESTIONS[platform].map((q) => (
            <button
              key={q}
              onClick={() => onSuggestion(q)}
              className="font-mono text-[11px] text-white/30 bg-transparent border border-white/7 rounded-full px-3 py-1.5 cursor-pointer transition-all hover:text-white/70 hover:border-white/20 hover:bg-white/4"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </>
  );
}