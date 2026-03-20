import axios from "axios";
import type { TwitterProfile, Tweet } from "./types";

const BASE_URL = "https://api.twitterapi.io";

function getHeaders() {
  const key = process.env.TWITTERAPI_IO_KEY;
  if (!key) throw new Error("TWITTERAPI_IO_KEY is not set.");
  return { "X-API-Key": key }; 
}

async function fetchProfile(username: string) {
  const res = await axios.get(`${BASE_URL}/twitter/user/info`, {
    params: { userName: username },
    headers: getHeaders(),
    timeout: 10000,
  });
  
  if (res.data.status !== "success") {
    throw new Error(`User '@${username}' not found or account is private.`);
  }

  console.log("fetch profile reuslt" + JSON.stringify(res.data))
  return res.data.data; // ← unwrap nested data object
}

async function fetchTweets(username: string): Promise<Tweet[]> {
  const res = await axios.get(`${BASE_URL}/twitter/user/last_tweets`, {
    params: { userName: username  , includeReplies : false},
    headers: getHeaders(),
    timeout: 10000,
  });

  if (res.data.status !== "success") return [];
  console.log("raw tweets response:", JSON.stringify(res.data));

  const rawTweets = res.data.data?.tweets ?? [];

   console.log("fetch profile reuslt" + JSON.stringify(res.data))
  return rawTweets
    .filter((t: any) => !t.isRetweet && !t.isReply)
    .map((t: any): Tweet => ({
      text: t.text ?? "",
      createdAt: t.createdAt ?? "",
      likes: t.likeCount ?? 0,
      retweets: t.retweetCount ?? 0,
      replies: t.replyCount ?? 0,
    }));
}

export async function collectTwitterProfile(
  handle: string
): Promise<TwitterProfile | { error: string }> {
  const username = handle.replace(/^@/, "").trim().toLowerCase();

  try {
    const u = await fetchProfile(username);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    
    let tweets: Tweet[] = [];
    try {
      tweets = await fetchTweets(username);
    } catch (tweetErr: any) {
      console.error("fetchTweets failed:", tweetErr?.message);
    }

    return {
      platform: "twitter",
      username: u.userName ?? username,
      name: u.name ?? username,
      bio: u.description ?? null,
      location: u.location ?? null,
      website: u.url ?? null,   
      profileImageUrl: u.profilePicture ?? null,
      verified: u.isBlueVerified ?? false,
      createdAt: u.createdAt ?? "",
      followersCount: u.followers ?? 0,
      followingCount: u.following ?? 0,
      tweetCount: u.statusesCount ?? 0,
      listedCount: u.listedCount ?? 0,
      recentTweets: tweets,
    };
  } catch (err: any) {
    if (err?.response?.status === 404) return { error: `User '@${username}' not found.` };
    if (err?.response?.status === 429) return { error: "Rate limit hit. Please try again later." };
    if (err?.response?.status === 401) return { error: "Invalid API key. Check TWITTERAPI_IO_KEY." };
    return { error: `Failed to fetch Twitter data: ${err?.message ?? String(err)}` };
  }
}