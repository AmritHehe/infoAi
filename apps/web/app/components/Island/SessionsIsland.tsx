"use client";

import { SessionSummary, Platform } from "../../types";

interface Props {
  sessions: SessionSummary[];
  isLoading: boolean;
  onResume: (session: SessionSummary) => void;
  onBack: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PlatformBadge({ platform }: { platform: Platform }) {
  return platform === "X" ? (
    <span className="text-[10px] font-mono bg-white/8 text-white/50 px-2 py-0.5 rounded-full">𝕏</span>
  ) : (
    <span className="text-[10px] font-mono bg-[#0a66c2]/20 text-[#0a66c2] px-2 py-0.5 rounded-full">in</span>
  );
}

export default function SessionsIsland({ sessions, isLoading, onResume, onBack }: Props) {
  return (
    <div className="w-full bg-[#111] border border-white/7 rounded-3xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_32px_64px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
        <span className="font-mono text-[13px] text-white/60 tracking-widest uppercase">
          past sessions
        </span>
        <button
          onClick={onBack}
          className="font-mono text-[11px] text-white/30 hover:text-white/70 transition-colors bg-transparent border-none cursor-pointer flex items-center gap-1.5"
        >
          ← back
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[420px] overflow-y-auto">
        {isLoading && (
          <div className="px-5 py-8 text-center">
            <p className="font-mono text-[12px] text-white/25 animate-pulse">loading sessions…</p>
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="font-mono text-[12px] text-white/25">no past sessions yet</p>
          </div>
        )}

        {!isLoading && sessions.map((session) => {
          const data = session.profile;
          const avatar = data.profileImageUrl;
          const name = data.name || data.handle;

          return (
            <button
              key={session.sessionId}
              onClick={() => onResume(session)}
              className="
                w-full flex items-center gap-3.5 px-5 py-3.5
                border-b border-white/4 last:border-none
                hover:bg-white/3 transition-colors duration-150
                text-left cursor-pointer bg-transparent
              "
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full shrink-0 bg-white/8 overflow-hidden flex items-center justify-center text-[13px] text-white/30 font-mono">
                {avatar
                  ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  : name.slice(0, 1).toUpperCase()
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[13px] text-white/90 truncate">{name}</span>
                  <PlatformBadge platform={data.platform} />
                </div>
                {session.lastMessage ? (
                  <p className="font-mono text-[11px] text-white/30 truncate">
                    {session.lastMessage.role === "user" ? "you: " : "ai: "}
                    {session.lastMessage.content}
                  </p>
                ) : (
                  <p className="font-mono text-[11px] text-white/20">no messages yet</p>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-mono text-[10px] text-white/20">
                  {timeAgo(session.updatedAt)}
                </span>
                {session.messageCount > 0 && (
                  <span className="font-mono text-[10px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded-full">
                    {session.messageCount} msg
                  </span>
                )}
              </div>

              {/* Arrow */}
              <span className="text-white/20 text-sm shrink-0">→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
