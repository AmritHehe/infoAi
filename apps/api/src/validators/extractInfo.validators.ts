import z from "zod";

export const GetUserInfoSchema = z.object({
  input: z.string().min(1, "Please provide an X handle or LinkedIn URL."),
});
