"use client";

import { Platform, ProfileData } from "../../types";

interface Props {
  profileData: ProfileData;
  platform: Platform;
  handle: string;
  onReset: () => void;
  onSignOut: () => void;
}

export default function ChatHeader({ profileData, platform, handle, onReset, onSignOut }: Props) {
  const d = profileData.Data;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/7 shrink-0">

      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/7 flex items-center justify-center text-sm font-bold border border-white/7">
        {d?.profileImageUrl
          ? <img src={d.profileImageUrl} alt="" className="w-full h-full object-cover" />
          : (d?.name ?? handle)[0]?.toUpperCase()
        }
      </div>


      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{d?.name ?? handle}</p>
        <p className="text-[11px] font-mono text-white/30 mt-0.5 truncate">
          {platform === "X"
            ? `@${d?.username ?? handle} · ${(d?.followersCount ?? 0).toLocaleString()} followers`
            : d?.currentRole ?? d?.headline ?? ""}
        </p>
      </div>


      <span className={`
        shrink-0 text-[10px] font-mono font-medium px-2 py-1 rounded-full
        ${platform === "X"
          ? "bg-white/8 text-white/70"
          : "bg-[#0a66c2]/15 text-[#4d9de0]"
        }
      `}>
        {platform === "X" ? "𝕏 twitter" : "in linkedin"}
      </span>


      <button
        onClick={onSignOut}
        title="Sign out"
        className="w-7 h-7 rounded-full border border-white/7 bg-transparent text-white/30 text-[11px] flex items-center justify-center cursor-pointer transition-all hover:border-white/20 hover:text-white/60 shrink-0"
      >
        ↪
      </button>


      <button
        onClick={onReset}
        title="New search"
        className="w-7 h-7 rounded-full border border-white/7 bg-transparent text-white/30 text-[11px] flex items-center justify-center cursor-pointer transition-all hover:border-white/20 hover:text-white/60 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}