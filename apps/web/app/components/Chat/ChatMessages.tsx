"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
              max-w-[85%] px-4 py-3 rounded-2xl font-mono text-[13px] leading-relaxed
              ${msg.role === "assistant"
                ? "bg-white/4 border border-white/7 rounded-tl-sm text-[#f0f0f0]"
                : "bg-[#e8ff47] text-black font-medium rounded-tr-sm break-words"
              }
            `}>
              {msg.role === "assistant" ? (
                <div className="markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0 leading-relaxed" {...props} />,
                      a: ({ node, ...props }) => (
                        <a
                          className="text-[#e8ff47] underline decoration-white/20 underline-offset-4 hover:decoration-[#e8ff47]/60 transition-colors"
                          target="_blank"
                          rel="noreferrer noopener"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1.5 marker:text-white/30" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5 marker:text-white/30" {...props} />,
                      li: ({ node, ...props }) => <li className="" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-bold text-white/90" {...props} />,
                      em: ({ node, ...props }) => <em className="text-white/70 italic" {...props} />,
                      code: (props) => {
                        const { children, className, node, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !match && !String(children).includes("\\n");
                        return isInline ? (
                          <code className="bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[12px]" {...rest}>
                            {children}
                          </code>
                        ) : (
                          <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-3 mb-3 overflow-x-auto">
                            <code className="text-[12px] text-white/70 tracking-wide" {...rest}>
                              {children}
                            </code>
                          </div>
                        );
                      },
                      h1: ({ node, ...props }) => <h1 className="font-bold text-[16px] text-white mt-4 mb-2" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="font-bold text-[15px] text-white/90 mt-4 mb-2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="font-bold text-[14px] text-white/80 mt-3 mb-1.5" {...props} />,
                      blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-2 border-[#e8ff47]/50 pl-3.5 my-3 text-white/60 italic" {...props} />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="w-full overflow-x-auto mb-3">
                          <table className="w-full text-left border-collapse" {...props} />
                        </div>
                      ),
                      th: ({ node, ...props }) => <th className="border-b border-white/10 p-2 font-semibold" {...props} />,
                      td: ({ node, ...props }) => <td className="border-b border-white/5 p-2 text-white/70" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
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