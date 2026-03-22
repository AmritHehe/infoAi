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

  const { handle, platform } = parsed.data;

  const normalizedHandle =
    platform === "LINKEDIN"
      ? extractUsername(handle)
      : handle.replace(/^@/, "").trim();
  const dbHandle = normalizedHandle.toLowerCase();

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
      return res.status(404).json({ error: profileData.error });
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
