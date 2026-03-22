"use client";

import { useState, useCallback } from "react";
import { Platform, Stage, Message, ProfileData, SessionSummary } from "../types";
import { getUserInfo, startSession, sendMessage, sendRagMessage, getSessions } from "../lib/api";
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
  const [ragMode, setRagMode] = useState(false);
  const [pastSessions, setPastSessions] = useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

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
      const reply = ragMode
        ? await sendRagMessage(sessionId, text)
        : await sendMessage(sessionId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      if (err.message?.includes("not indexed")) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "⚠ Profile not indexed yet. Enable RAG indexing first, then try again.",
        }]);
      } else {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        }]);
      }
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, sessionId, ragMode]);

  const handleShowSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setError(null);
    try {
      const userId = getUserIdFromToken();
      if (!userId) throw new Error("Not authenticated");
      const sessions = await getSessions(userId);
      setPastSessions(sessions);
      setStage("sessions");
    } catch (err: any) {
      setError(err.message ?? "Failed to load sessions.");
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const handleResumeSession = useCallback((session: SessionSummary) => {
    const restoredProfile: ProfileData = {
      id: session.profile.id,
      platform: session.profile.platform,
      handle: session.profile.handle,
      Data: {
        name: session.profile.name,
        profileImageUrl: session.profile.profileImageUrl ?? undefined,
        followersCount: session.profile.followersCount ?? undefined,
        headline: session.profile.headline ?? undefined,
        currentRole: session.profile.currentRole ?? undefined,
        username: session.profile.handle,
      },
    };
    setProfileData(restoredProfile);
    setHandle(session.profile.handle);
    setPlatform(session.profile.platform);
    setSessionId(session.sessionId);
    setMessages(
      session.messages.map((m) => ({ role: m.role, content: m.content }))
    );
    setRagMode(false);
    setError(null);
    setStage("chat");
  }, []);

  const handleReset = useCallback(() => {
    setStage("idle");
    setHandle("");
    setProfileData(null);
    setSessionId(null);
    setMessages([]);
    setError(null);
    setRagMode(false);
    setPastSessions([]);
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
    ragMode, setRagMode,
    pastSessions,
    isLoadingSessions,
    handleExtract,
    handleSend,
    handleReset,
    handleShowSessions,
    handleResumeSession,
  };
}