"use client";

import { Platform, ProfileData, Message } from "../../types";
import ChatHeader from "../../components/Chat/ChatHeader";
import ChatMessages from "../../components/Chat/ChatMessages";
import ChatInput from "../../components/Chat/ChatInput";

interface Props {
  profileData: ProfileData;
  platform: Platform;
  handle: string;
  messages: Message[];
  input: string;
  isSending: boolean;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  onReset: () => void;
  onSignOut: () => void;
}

export default function ChatIsland({
  profileData, platform, handle,
  messages, input, isSending,
  onInputChange, onSend, onReset, onSignOut,
}: Props) {
  return (
    <div className="w-full bg-[#111] border border-white/7 rounded-[20px] overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_32px_64px_rgba(0,0,0,0.6)] flex flex-col max-h-[72vh]">
      <ChatHeader
        profileData={profileData}
        platform={platform}
        handle={handle}
        onReset={onReset}
        onSignOut={onSignOut}
      />
      <ChatMessages
        messages={messages}
        isSending={isSending}
        platform={platform}
        onSuggestion={(q) => onSend(q)}
      />
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSend={() => onSend()}
        disabled={isSending}
      />
    </div>
  );
}