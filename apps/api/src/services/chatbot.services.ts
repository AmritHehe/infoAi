


export async function callOpenRouter(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "minimax/minimax-m2.5:free",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
      reasoning: { enabled: true },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenRouter error ${response.status}: ${JSON.stringify(err)}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content ?? "Sorry, I could not generate a response.";
}

export function buildSystemPrompt(profile: any): string {
  const data = profile.Data as any;
  const platform = profile.platform;

  if (platform === "X") {
    const tweets = (data.recentTweets ?? [])
      .map((t: any, i: number) =>
        `${i + 1}. "${t.text}" ( ${t.likes} |  ${t.retweets} | ${t.replies})`
      )
      .join("\n");

    return `You are an AI assistant helping users explore the public X (Twitter) profile of a person.

PROFILE:
- Name: ${data.name}
- Username: @${data.username}
- Bio: ${data.bio ?? "N/A"}
- Location: ${data.location ?? "N/A"}
- Website: ${data.website ?? "N/A"}
- Verified: ${data.verified ? "Yes" : "No"}
- Joined: ${data.createdAt}
- Followers: ${data.followersCount?.toLocaleString()}
- Following: ${data.followingCount?.toLocaleString()}
- Total Tweets: ${data.tweetCount?.toLocaleString()}

RECENT TWEETS:
${tweets || "No tweets available."}

INSTRUCTIONS:
- Answer questions based ONLY on the data above.
- Be conversational, insightful and friendly.
- If asked about something not in the data, say it's not publicly available.
- Never fabricate stats or tweets.
- Stay neutral when asked for opinions about the person.`;
  } else {
    const experience = (data.experience ?? [])
      .map((e: any) => `• ${e.title} at ${e.company}${e.duration ? ` (${e.duration})` : ""}`)
      .join("\n");

    const education = (data.education ?? [])
      .map((e: any) => `• ${e.school}${e.degree ? ` — ${e.degree}` : ""}`)
      .join("\n");

    return `You are an AI assistant helping users explore the public LinkedIn profile of a professional.

PROFILE:
- Name: ${data.name}
- Headline: ${data.headline ?? "N/A"}
- Current Role: ${data.currentRole ?? "N/A"}
- Location: ${data.location ?? "N/A"}
- Summary: ${data.summary ?? "N/A"}
- Skills: ${(data.skills ?? []).join(", ") || "N/A"}
- Connections: ${data.connectionsCount ?? "N/A"}

EXPERIENCE:
${experience || "N/A"}

EDUCATION:
${education || "N/A"}

INSTRUCTIONS:
- Answer questions based ONLY on the data above.
- Be conversational, professional and helpful.
- If asked about something not in the data, say it's not publicly listed.
- Never fabricate job titles or companies.
- Stay neutral when asked for opinions about the person.`;
  }
}
