import type { Request, Response } from "express"
import { GetUserInfoSchema } from "../validators/extractInfo.validators"
import { collectTwitterProfile } from "../services/collectors/xfetcher"
import { extractUsername } from "../services/collectors/Li_at_methodLinkedin"
import { collectLinkedInProfile } from "../services/collectors/Li_at_methodLinkedin"
import { prisma } from "@repo/database"

export async function ExtractUserInfoController(req: Request, res: Response) {
  const parsed = GetUserInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { input } = parsed.data;
  let platform: "X" | "LINKEDIN" = "X";
  let handle = input.trim();

  // Auto-Detect Platform
  if (handle.includes("linkedin.com/in/")) {
    platform = "LINKEDIN";
    try {
      handle = extractUsername(handle);
    } catch {
      return res.status(400).json({ error: "Invalid LinkedIn URL format. Make sure it contains linkedin.com/in/username." });
    }
  } else if (handle.includes("x.com/") || handle.includes("twitter.com/")) {
    platform = "X";
    handle = handle.split("x.com/").pop()?.split("twitter.com/").pop()?.split("?")[0]?.replace(/\/$/, "") || handle;
  } else {
    // Default to X
    platform = "X";
    handle = handle.replace(/^@/, "").trim();
  }

  const dbHandle = handle.toLowerCase();

  try {
    const existing = await prisma.profile.findUnique({
      where: { platform_handle: { platform, handle: dbHandle } },
    });

    if (existing) {
      return res.json({ success: true, profile: existing, source: "cache" });
    }

    const profileData =
      platform === "X"
        ? await collectTwitterProfile(dbHandle)
        : await collectLinkedInProfile(handle);

    if ("error" in profileData) {
      // Provide custom error messaging based on platform
      const errorMsg = platform === "X"
        ? `${profileData.error} (Note: X handles can be case-sensitive or private. Double check the exact spelling!)`
        : `${profileData.error} (Could not read this LinkedIn profile. It might be private.)`;
      return res.status(404).json({ error: errorMsg });
    }

    // 4. Upsert into DB handles race conditions between two requests

    const profile = await prisma.profile.upsert({
      where: {
        platform_handle: { platform, handle: dbHandle },
      },
      update: { Data: profileData as any },
      create: { platform, handle: dbHandle, Data: profileData as any },
    });

    return res.status(200).json({ success: true, profile });
  } catch (err: any) {
    console.error("getUserInfo error:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }

    //findout if the user twitter ID exists or not 
    //If not exists , throw an error 
    //If exists scrape the data
}
