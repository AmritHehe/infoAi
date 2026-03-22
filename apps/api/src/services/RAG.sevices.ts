


import axios from "axios";
import { prisma } from "@repo/database";
 
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const EMBEDDING_DIMS = 1024;

interface Chunk {
  text: string;
  type: string;
}
 
interface SearchResult {
  id: string;
  chunkText: string;
  chunkType: string;
  profileId: string;
  similarity: number;
}
 
// ── Embedding via OpenRouter ──────────────────────────────────────────────────
 
export async function getEmbedding(text: string): Promise<number[]> {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/embeddings",
    {
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: 1024
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
 
  return res.data.data[0].embedding as number[];
}
 
export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/embeddings",
    {
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );
 
  return res.data.data.map((d: any) => d.embedding) as number[][];
}
 
// ── Chunking ──────────────────────────────────────────────────────────────────
 
export function chunkProfileData(profileData: any, platform: string): Chunk[] {
  const chunks: Chunk[] = [];
  const d = profileData;
 
  if (platform === "X") {
    // Bio chunk
    if (d.bio) {
      chunks.push({
        text: `${d.name} (@${d.username}) bio: ${d.bio}`,
        type: "bio",
      });
    }
 
    // Stats chunk
    chunks.push({
      text: `${d.name} (@${d.username}) has ${d.followersCount?.toLocaleString()} followers, follows ${d.followingCount?.toLocaleString()} accounts, and has posted ${d.tweetCount?.toLocaleString()} tweets. Account created: ${d.createdAt}. Location: ${d.location || "not specified"}. Website: ${d.website || "not specified"}.`,
      type: "stats",
    });
 
    // Individual tweet chunks
    for (const tweet of d.recentTweets ?? []) {
      chunks.push({
        text: `Tweet by ${d.name}: "${tweet.text}" — ${tweet.likes} likes, ${tweet.retweets} retweets, ${tweet.replies} replies.`,
        type: "tweet",
      });
    }
  } else {
    // LinkedIn
    if (d.name) {
      chunks.push({
        text: `${d.name} — ${d.headline ?? ""}. Currently: ${d.currentRole ?? "N/A"}. Location: ${d.location ?? "N/A"}.`,
        type: "bio",
      });
    }
 
    if (d.summary) {
      chunks.push({
        text: `About ${d.name}: ${d.summary}`,
        type: "summary",
      });
    }
 
    for (const exp of d.experience ?? []) {
      chunks.push({
        text: `${d.name} worked as ${exp.title} at ${exp.company}${exp.duration ? ` for ${exp.duration}` : ""}${exp.description ? `. ${exp.description}` : ""}.`,
        type: "experience",
      });
    }
 
    for (const edu of d.education ?? []) {
      chunks.push({
        text: `${d.name} studied at ${edu.school}${edu.degree ? `, ${edu.degree}` : ""}${edu.field ? ` in ${edu.field}` : ""}${edu.years ? ` (${edu.years})` : ""}.`,
        type: "education",
      });
    }
 
    if ((d.skills ?? []).length > 0) {
      chunks.push({
        text: `${d.name}'s skills include: ${d.skills.join(", ")}.`,
        type: "skills",
      });
    }
  }
 
  return chunks.filter((c) => c.text.trim().length > 10);
}
 
// ── Index profile into Neon vector store ────────────────────────────────────
 
export async function indexProfile(profileId: string): Promise<number> {
  // 1. Load profile from DB
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
  });
 
  if (!profile) throw new Error(`Profile ${profileId} not found`);
 
  const profileData = profile.Data as any;
  const platform = profile.platform;
 
  // 2. Delete existing embeddings for this profile (re-index)
  await prisma.embedding.deleteMany({ where: { profileId } });
 
  // 3. Chunk the profile data
  const chunks = chunkProfileData(profileData, platform);
  if (chunks.length === 0) throw new Error("No chunks generated from profile data");
 
  // 4. Get embeddings in batch
  const embeddings = await getEmbeddingsBatch(chunks.map((c) => c.text));
 
  // 5. Save to DB using raw SQL (pgvector requires it)
  for (let i = 0; i < chunks.length; i++) {
    const vector = `[${embeddings[i].join(",")}]`;
    await prisma.$executeRaw`
      INSERT INTO "Embedding" (id, "profileId", "chunkText", "chunkType", embedding, "createdAt")
      VALUES (
        gen_random_uuid(),
        ${profileId},
        ${chunks[i].text},
        ${chunks[i].type},
        ${vector}::vector,
        NOW()
      )
    `;
  }
 
  return chunks.length;
}
 
// ── Vector search ────────────────────────────────────────────────────────────
 
export async function searchSimilarChunks(
  profileId: string,
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  // 1. Embed the query
  const queryEmbedding = await getEmbedding(query);
  const vectorString = `[${queryEmbedding.join(",")}]`;
 
  // 2. Vector similarity search in Neon
  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      "chunkText",
      "chunkType",
      "profileId",
      1 - (embedding <=> ${vectorString}::vector) AS similarity
    FROM "Embedding"
    WHERE "profileId" = ${profileId}
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${topK}
  `;
 
  return results;
}
 
// ── RAG answer generation ─────────────────────────────────────────────────────
 
export async function ragAnswer(
  profileId: string,
  question: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  // 1. Retrieve relevant chunks
  const chunks = await searchSimilarChunks(profileId, question, 5);
 
  if (chunks.length === 0) {
    return "I don't have enough indexed data to answer that question. Try re-indexing the profile.";
  }
 
  // 2. Build context from chunks
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.chunkType}) ${c.chunkText}`)
    .join("\n");
 
  // 3. Build RAG system prompt
  const systemPrompt = `You are an AI assistant answering questions about a public profile using retrieved context.
 
RETRIEVED CONTEXT (most relevant chunks):
${context}
 
INSTRUCTIONS:
- Answer based ONLY on the context above.
- Be conversational and precise.
- If the context doesn't contain the answer, say so clearly.
- Never fabricate information not present in the context.
- Reference specific details from the context when relevant.`;
 
  // 4. Call OpenRouter LLM
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "stepfun/step-3.5-flash:free",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: question },
      ],
    }),
  });
 
  if (!response.ok) {
    const err = await response.json();
    throw new Error(`LLM error: ${JSON.stringify(err)}`);
  }
 
  const result : any = await response.json();
  return result.choices[0]?.message?.content ?? "Could not generate a response.";
}

