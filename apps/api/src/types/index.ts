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
 