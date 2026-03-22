export type Platform = "X" | "LINKEDIN";
export type Stage = "idle" | "loading" | "chat" | "sessions";
export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ProfileData {
  id: string;
  platform: Platform;
  handle: string;
  Data: {
    name?: string;
    username?: string;
    bio?: string;
    location?: string;
    website?: string;
    profileImageUrl?: string;
    verified?: boolean;
    createdAt?: string;
    followersCount?: number;
    followingCount?: number;
    tweetCount?: number;
    headline?: string;
    currentRole?: string;
    recentTweets?: {
      text: string;
      likes: number;
      retweets: number;
      replies: number;
    }[];
  };
}

export interface SessionSummary {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  profile: {
    id: string;
    platform: Platform;
    handle: string;
    name: string;
    headline: string | null;
    profileImageUrl: string | null;
    followersCount: number | null;
    currentRole: string | null;
  };
  messageCount: number;
  lastMessage: {
    role: MessageRole;
    content: string;
    createdAt: string;
  } | null;
  messages: { id: string; role: MessageRole; content: string; createdAt: string }[];
}