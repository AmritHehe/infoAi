import z from "zod";

export const StartChatSchema = z.object({
  profileId: z.string().uuid(),
  userId: z.string().uuid().nullish().or(z.literal("")),
});

export const SendMessageSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1).max(2000),
});
export const GetSessionsSchema = z.object({
  userId: z.string().uuid(),
});