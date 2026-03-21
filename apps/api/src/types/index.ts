export interface TwitterProfile {
  platform: "twitter";
  username: string;
  name: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  profileImageUrl: string | null;
  verified: boolean;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  recentTweets: Tweet[];
}

export interface Tweet {
  text: string;
  createdAt: string;
  likes: number;
  retweets: number;
  replies: number;
}

export interface LinkedInProfile {
  platform: "linkedin";
  name: string;
  headline: string | null;
  summary: string | null;
  location: string | null;
  profileImageUrl: string | null;
  profileUrl: string;
  currentRole: string | null;
  experience: Experience[];
  education: Education[];
  skills: string[];
  articles: Article[];
  connectionsCount: string | null;
  website: string | null;
}

export interface Experience {
  title: string;
  company: string;
  duration: string | null;
  description: string | null;
}

export interface Education {
  school: string;
  degree: string | null;
  field: string | null;
  years: string | null;
}

export interface Article {
  title: string;
  url: string | null;
}

export type ProfileData = TwitterProfile | LinkedInProfile;

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Session {
  platform: "twitter" | "linkedin";
  profileData: ProfileData;
  conversationHistory: ConversationMessage[];
  createdAt: Date;
  dbSessionId: string; // references Session.id in DB
  profileId: string;   // references Profile.id in DB
}

export interface LoadProfileRequest {
  handleOrUrl: string;
  platform: "twitter" | "linkedin";
  sessionId: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}