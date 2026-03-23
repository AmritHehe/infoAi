import z from "zod";

export const RagChatSchema = z.object({
  sessionId: z.string(), // can be a uuid or a guest string
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});