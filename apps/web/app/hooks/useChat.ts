"use client";

import { useState, useCallback } from "react";
import { Platform, Stage, Message, ProfileData } from "../types";

import { getUserInfo, startSession, sendMessage } from "../lib/api";
import { getUserIdFromToken } from "./useAuth";

export function useChat() {
  const [platform, setPlatform] = useState<Platform>("X");
  const [handle, setHandle] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [loadingStep, setLoadingStep] = useState(0);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = useCallback(async () => {
    if (!handle.trim()) return;
    setStage("loading");
    setLoadingStep(0);
    setError(null);

    try {
      const userId = getUserIdFromToken();
      if (!userId) throw new Error("Not authenticated");

      const profile = await getUserInfo(handle.trim(), platform);
      setProfileData(profile);

      const sid = await startSession(profile.id, userId);
      setSessionId(sid);

      await new Promise((r) => setTimeout(r, 600));
      setStage("chat");
      setMessages([{
        role: "assistant",
        content: `Loaded ${platform === "X" ? "@" : ""}${handle}'s public profile. Ask me anything about them.`,
      }]);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setStage("idle");
    }
  }, [handle, platform]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = overrideText ?? input;
    if (!text.trim() || isSending || !sessionId) return;

    setInput("");
    setIsSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const reply = await sendMessage(sessionId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, sessionId]);

  const handleReset = useCallback(() => {
    setStage("idle");
    setHandle("");
    setProfileData(null);
    setSessionId(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    platform, setPlatform,
    handle, setHandle,
    stage,
    loadingStep, setLoadingStep,
    profileData,
    messages,
    input, setInput,
    isSending,
    error,
    handleExtract,
    handleSend,
    handleReset,
  };
}