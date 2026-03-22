
// ── POST /rag/index/:profileId ────────────────────────────────────────────────
// Chunks profile data, embeds it, and stores in Neon vector store
import type { Request  , Response } from "express"
import { prisma } from "@repo/database"
import { indexProfile, ragAnswer } from "../services/RAG.sevices";
import { RagChatSchema } from "../validators/rag.validators"

export async function RAGchunkProfileDataController(req: Request, res: Response) {
  const profileId = req.params.profileId as string;

  if (!profileId) {
    return res.status(400).json({ error: "profileId is required" });
  }
 
  try {
    const chunksIndexed = await indexProfile(profileId);
    return res.status(200).json({
      success: true,
      chunksIndexed,
      message: `Successfully indexed ${chunksIndexed} chunks for profile ${profileId}`,
    });
  } catch (err: any) {
    console.error("RAG index error:", err);
    return res.status(500).json({ error: err.message ?? "Failed to index profile" });
  }
};
 
// ── GET /rag/status/:profileId ────────────────────────────────────────────────
// Check if a profile has been indexed and how many chunks
export async function RAGProfileStatusController(req: Request, res: Response) {
  const profileId = req.params.profileId as string;

  try {
    const count = await prisma.embedding.count({ where: { profileId } });
    return res.status(200).json({
      indexed: count > 0,
      chunksCount: count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
 

// ── POST /rag/chat ────────────────────────────────────────────────────────────
// RAG-powered chat: embed question → vector search → LLM answer

 
export async function  RAGChatController( req : Request  , res : Response ){
  const parsed = RagChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }
 
  const { sessionId, message } = parsed.data;
 
  try {
    // 1. Load session + profile
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        profile: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
 
    if (!session) {
      return res.status(404).json({ error: "Session not found. Call /start first." });
    }
 
    // 2. Check profile is indexed
    const embeddingCount = await prisma.embedding.count({
      where: { profileId: session.profileId },
    });
 
    if (embeddingCount === 0) {
      return res.status(400).json({
        error: "Profile not indexed yet. Call POST /rag/index/:profileId first.",
        notIndexed: true,
      });
    }
 
    // 3. Build conversation history
    const history = session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
 
    // 4. RAG answer
    const reply = await ragAnswer(session.profileId, message, history);
 
    // 5. Save messages
    await prisma.$transaction([
      prisma.message.create({ data: { sessionId, role: "user", content: message } }),
      prisma.message.create({ data: { sessionId, role: "assistant", content: reply } }),
      prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } }),
    ]);
 
    return res.status(200).json({ reply, mode: "rag" });
  } catch (err: any) {
    console.error("RAG chat error:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
};
