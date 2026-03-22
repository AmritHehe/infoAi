import z from "zod"

export const StartChatSchema = z.object({
  profileId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const SendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export const GetSessionsSchema = z.object({
  userId: z.string().uuid(),
});