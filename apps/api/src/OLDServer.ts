import { password } from "bun"
import express from "express"
import z, { email, success } from "zod"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import OpenAI from "openai";
import cors from "cors"
import {prisma} from "@repo/database"
import { collectTwitterProfile } from "./services/collectors/xfetcher"
import {  extractUsername } from "./services/linkedinFetcher"
import { collectLinkedInProfile } from "./services/collectors/Li_at_methodLinkedin"
import axios from "axios"

import { indexProfile, ragAnswer } from "./services/RAG.sevices";
const app = express()

app.use(express.json())
app.use(cors())
const SignUpSchema = z.object({

    name : z.string(),
    email : z.string(),
    password : z.string()

})
const SignInSchema = z.object({
    email : z.string(),
    password : z.string()
})

const extractInfo = z.object({
    userName : z.string(),
    Platform : z.enum(["X" , "Linkedin"]),
    url : z.string().optional()

})

app.get("/" , (req , res)=> { 
    res.json("server is running healthy")
})

app.post("/signup" , async  (req , res)=> { 
    const {data , success}  = SignUpSchema.safeParse(req.body)

    if(!data || !success){ 
        return res.status(400).json({
            success : false , 
            data : null , 
            message : "you have sent invalid request/wrong schema",
            error : "INVALID_REQUEST"
        })
    }
    try { 
        const ExisitngUser = await prisma.user.findUnique({
            where : { 
                email : data.email
            }
        })
        if(ExisitngUser){ 
            return res.status(400).json({
                success : false , 
                data : null , 
                message : "User with this email id already exist",
                error : "INVALID_REQUEST"
            })
        }
    }
    catch(e){ 
        return res.status(500).json({
            success : false , 
            data : null , 
            error : "DATABASE_DOWN",
            message : "Couldnt connect to database" + JSON.stringify(e)
        })
    }
    try { 
        const hasedPassword = await bcrypt.hash(data.password , 10)

        const newUser = await prisma.user.create({
            data : { 
                ...data ,
                password : hasedPassword       
            }
        })

        return res.status(201).json({
            success : true , 
            data : {
                email : data.email, 
                name : data.name
            },
            error : null ,
            message : "user created sucessfully"
        })
    }

    catch(e){
        return res.status(500).json({
            success : false , 
            data : null , 
            error : "DATABASE_DOWN",
            message : "Couldnt connect to database" + JSON.stringify(e)
        })  
    }
})

app.post("/signin" , async  (req , res)=> { 
    const {data , success}  = SignInSchema.safeParse(req.body)

    if(!data || !success){ 
        return res.status(400).json({
            success : false , 
            data : null , 
            message : "you have sent invalid request/wrong schema",
            error : "INVALID_REQUEST"
        })
    }
    try { 
        const ExistingUser = await prisma.user.findUnique({
            where : { 
                email : data.email
            }
        })
        if(!ExistingUser){ 
            return res.status(401).json({
                success : false , 
                data : null , 
                message : "User Doesnt exist",
                error : "UNAUTHORIZED"
            })
        }
        const isPasswordCorrect = await bcrypt.compare(data.password , ExistingUser.password)

        if(!isPasswordCorrect){ 
            return res.status(401).json({
                success : false , 
                data : null , 
                message : "User Doesnt exist",
                error : "UNAUTHORIZED"
            })
        }
        const secret = process.env.JWT_SECRET!
        if(!secret){ 
            return res.status(500).json({
                success : false,
                data : null , 
                error : "INVALID",
                message : "JWT SECRET NOT PRESENT IN BACKEND"
            })
        }
        const JWTToken = jwt.sign({ userId: ExistingUser.id } , secret)

        return res.status(200).json({
            success : true , 
            data : { 
                token : JWTToken,
            },
            error : null , 
            message : "Sucessfully Signed you In"
        })

    }
    catch(e){ 
        return res.status(500).json({
            success : false , 
            data : null , 
            error : "DATABASE_DOWN",
            message : "Couldnt connect to database" + JSON.stringify(e)
        })
    }

})


app.post("/extractInfo" ,  async ( req , res) => { 
    const {data , success } = extractInfo.safeParse(req.body)
     if(!data || !success){ 
        return res.status(400).json({
            success : false , 
            data : null , 
            message : "you have sent invalid request/wrong schema",
            error : "INVALID_REQUEST"
        })
    }
    //findout if the user twitter ID exists or not 
    //If not exists , throw an error 
    //If exists scrape the data
})


const GetUserInfoSchema = z.object({
  handle: z.string().min(1),
  platform: z.enum(["X", "LINKEDIN"]),
});


app.post("/getUserInfo", async (req, res) => {

  const parsed = GetUserInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { handle, platform } = parsed.data;
  
  const normalizedHandle =
    platform === "LINKEDIN"
        ? extractUsername(handle)
        : handle.replace(/^@/, "").trim()
    const dbHandle = normalizedHandle.toLowerCase();


  try {


    const profileData =
        platform === "X"
            ? await collectTwitterProfile(handle)
            : await collectLinkedInProfile(handle);



    if ("error" in profileData) {
      return res.status(404).json({ error: profileData.error });
    }

    

    const profile = await prisma.profile.upsert({
      where: {
        platform_handle: {
          platform,
          handle : dbHandle,
        },
      },
      update: {
        Data: profileData,
      },
      create: {
        platform,
        handle : dbHandle,
        Data: profileData,
      },
    });

    return res.status(200).json({ success: true, profile });
  } catch (err: any) {
    console.error("getUserInfo error:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
});

const StartChatSchema = z.object({
  profileId: z.string().uuid(),
  userId: z.string().uuid(),
});

const SendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

// ---- helper: call OpenRouter ----
async function callOpenRouter(
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

// ---- helper: build system prompt from profile data ----
function buildSystemPrompt(profile: any): string {
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

// ---- POST /chat/start ----
// Creates a new session for a profile

app.post("/start", async (req, res) => {
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
        tokens: 0, // ← no messages field, Message is a separate table
      },
    });

    return res.status(201).json({ success: true, sessionId: session.id });
  } catch (err: any) {
    console.error("start session error:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
});

// ---- POST /chat/message ----
app.post("/message", async (req, res) => {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { sessionId, message } = parsed.data;

  try {
    // 1. Load session + profile + all past messages from DB
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        profile: true,
        messages: {
          orderBy: { createdAt: "asc" }, // ← chronological order matters for AI context
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found. Call /chat/start first." });
    }

    // 2. Build conversation history from DB messages
    const history = session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 3. Build system prompt from profile data
    const systemPrompt = buildSystemPrompt(session.profile);

    // 4. Call OpenRouter with full history + new message
    const reply = await callOpenRouter(systemPrompt, [
      ...history,
      { role: "user", content: message },
    ]);

    // 5. Save user message and AI reply to DB in one transaction
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
});

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const EMBEDDING_DIMS = 1024;


 
// ── POST /rag/index/:profileId ────────────────────────────────────────────────
// Chunks profile data, embeds it, and stores in Neon vector store
app.post("/rag/index/:profileId", async (req, res) => {
  const { profileId } = req.params;
 
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
});
 
// ── GET /rag/status/:profileId ────────────────────────────────────────────────
// Check if a profile has been indexed and how many chunks
app.get("/rag/status/:profileId", async (req, res) => {
  const { profileId } = req.params;
 
  try {
    const count = await prisma.embedding.count({ where: { profileId } });
    return res.status(200).json({
      indexed: count > 0,
      chunksCount: count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
 
// ── POST /rag/chat ────────────────────────────────────────────────────────────
// RAG-powered chat: embed question → vector search → LLM answer
const RagChatSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});
 
app.post("/rag/chat", async (req, res) => {
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
});


const GetSessionsSchema = z.object({
  userId: z.string().uuid(),
});

app.get("/sessions", async (req, res) => {
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

    // Shape the response cleanly
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
              content: lastMessage.content.slice(0, 100), // preview
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
});

app.listen(3000, ()=> { 
    console.log("server is running on port 3000")
})