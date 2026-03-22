import { Platform } from "../types";

const API_BASE = "https://api-infoai.amrithehe.com";

function getHeaders(includeContentType = true) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {};
  if (includeContentType) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function getUserInfo(handle: string, platform: Platform) {
  const res = await fetch(`${API_BASE}/getUserInfo`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ handle, platform }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch profile");
  return data.profile;
}

export async function startSession(profileId: string, userId: string) {
  const res = await fetch(`${API_BASE}/start`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ profileId, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to start session");
  return data.sessionId as string;
}

export async function sendMessage(sessionId: string, message: string) {
  const res = await fetch(`${API_BASE}/message`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to get reply");
  return data.reply as string;
}

export async function signIn(email: string, password: string) {
  const res = await fetch(`${API_BASE}/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Sign in failed");
  return data.data.token as string;
}

export async function signUp(name: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Sign up failed");
  return data;
}

export async function indexProfile(profileId: string) {
  const res = await fetch(`${API_BASE}/rag/index/${profileId}`, {
    method: "POST",
    headers: getHeaders(false),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to index profile");
  return data as { success: boolean; chunksIndexed: number; message: string };
}
 
export async function getRagStatus(profileId: string) {
  const res = await fetch(`${API_BASE}/rag/status/${profileId}`, {
    headers: getHeaders(false),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to get RAG status");
  return data as { indexed: boolean; chunksCount: number };
}
 
export async function sendRagMessage(sessionId: string, message: string) {
  const res = await fetch(`${API_BASE}/rag/chat`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to get RAG reply");
  return data.reply as string;
}

export async function getSessions(userId: string) {
  const res = await fetch(`${API_BASE}/sessions?userId=${userId}`, {
    headers: getHeaders(false),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch sessions");
  return data.sessions;
}