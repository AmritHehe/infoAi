import { StartChatSchema , SendMessageSchema , GetSessionsSchema } from "../validators/chatbot.validators";
import  type { Request , Response } from "express"
import {prisma} from "@repo/database"
import { callOpenRouter , buildSystemPrompt  } from "../services/chatbot.services";


export async function  NewSessionController ( req : Request  , res : Response ) { 

  const parsed = StartChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { profileId, userId } = parsed.data;

  try {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found. Call /getUserInfo first." });
    }

    const session = await prisma.session.create({
      data: {
        userId,
        profileId,
        tokens: 0, 
      },
    });

    return res.status(201).json({ success: true, sessionId: session.id });
  } catch (err: any) {
    console.error("start session error:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
};


export async function  NewMessageController ( req : Request  , res : Response ) {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { sessionId, message } = parsed.data;

  try {

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        profile: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found. Call /chat/start first." });
    }


    const history = session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));


    const systemPrompt = buildSystemPrompt(session.profile);


    const reply = await callOpenRouter(systemPrompt, [
      ...history,
      { role: "user", content: message },
    ]);


    await prisma.$transaction([
      prisma.message.create({
        data: {
          sessionId,
          role: "user",
          content: message,
        },
      }),
      prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: reply,
        },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error("chat message error:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
};

export async function  GetSessionsController ( req : Request  , res : Response ) {
  const parsed = GetSessionsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { userId } = parsed.data;

  try {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        profile: {
          select: {
            id: true,
            platform: true,
            handle: true,
            Data: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });


    const formatted = sessions.map(session => {
      const data = session.profile.Data as any;
      const lastMessage = session.messages[session.messages.length - 1] ?? null;

      return {
        sessionId: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        profile: {
          id: session.profile.id,
          platform: session.profile.platform,
          handle: session.profile.handle,
          name: data?.name ?? session.profile.handle,
          headline: data?.headline ?? null,
          profileImageUrl: data?.profileImageUrl ?? null,
          followersCount: data?.followersCount ?? null,
          currentRole: data?.currentRole ?? null,
        },
        messageCount: session.messages.length,
        lastMessage: lastMessage
          ? {
              role: lastMessage.role,
              content: lastMessage.content.slice(0, 100),
              createdAt: lastMessage.createdAt,
            }
          : null,
        messages: session.messages,
      };
    });

    return res.status(200).json({
      success: true,
      sessions: formatted,
      total: formatted.length,
    });
  } catch (err: any) {
    console.error("getSessions error:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
};