import z from "zod"

export const GetUserInfoSchema = z.object({
  handle: z.string().min(1),
  platform: z.enum(["X", "LINKEDIN"]),
});
