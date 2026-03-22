import z from "zod"
export const RagChatSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});
 