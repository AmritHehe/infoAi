import axios from "axios";
import type { LinkedInProfile } from "./types";

const BASE_URL = "https://api.sociavault.com/v1/scrape/linkedin";

function getApiKey() {
  const key = process.env.SOCIAVAULT_API_KEY;
  if (!key) throw new Error("SOCIAVAULT_API_KEY is not set.");
  return key;
}

export function extractUsername(urlOrHandle: string): string {
  try {
    if (urlOrHandle.includes("linkedin.com")) {
      const url = new URL(
        urlOrHandle.startsWith("http") ? urlOrHandle : `https://${urlOrHandle}`
      );
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("in");
      if (idx !== -1 && parts[idx + 1]) {
        const slug = parts[idx + 1].replace(/\/$/, "").trim();
        console.log(`[LinkedIn] Extracted slug from URL: "${slug}"`);
        return slug;
      }
    }
  } catch (e) {
    console.log(`[LinkedIn] URL parse failed, using raw input: "${urlOrHandle}"`);
  }
  return urlOrHandle.replace(/^\/|\/$/g, "").trim();
}
// helper to convert object or array to array
function toArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  // convert {"0": {...}, "1": {...}} → [{...}, {...}]
  return Object.values(val);
}

export async function collectLinkedInProfile(
  urlOrHandle: string
): Promise<LinkedInProfile | { error: string }> {
  const username = extractUsername(urlOrHandle);
  const linkedinUrl = `https://www.linkedin.com/in/${username}/`;

  console.log(`[LinkedIn] Fetching: "${linkedinUrl}"`);

  try {
    const res = await axios.get(`${BASE_URL}/profile`, {
      params: { url: linkedinUrl },
      headers: { "x-api-key": getApiKey() },
      timeout: 20000,
    });

    console.log(`[LinkedIn] Status: ${res.status}`);

    const d = res.data?.data ?? res.data;

    if (!d?.name) {
      console.log(`[LinkedIn] No name found — keys:`, Object.keys(d ?? {}));
      return { error: `LinkedIn profile '${username}' not found or is private.` };
    }

    console.log(`[LinkedIn] Found: "${d.name}"`);

    // ← use toArray() for all fields that come back as objects
    const experienceRaw = toArray(d.experience);
    const educationRaw = toArray(d.education);
    const articlesRaw = toArray(d.articles);

    const experience = experienceRaw.map((e: any) => ({
      title: e.member?.roleName ?? e.title ?? "Unknown Role",
      company: e.name ?? e.company ?? "Unknown",
      duration: e.member?.startDate
        ? `${e.member.startDate}${e.member.endDate ? ` - ${e.member.endDate}` : " - Present"}`
        : null,
      description: e.description ?? null,
    }));

    const education = educationRaw.map((e: any) => ({
      school: e.name ?? e.school ?? "Unknown",
      degree: e.member?.roleName ?? e.degree ?? null,
      field: e.fieldOfStudy ?? null,
      years: e.member?.startDate
        ? `${e.member.startDate}${e.member.endDate ? ` - ${e.member.endDate}` : ""}`
        : null,
    }));

    const articles = articlesRaw.map((a: any) => ({
      title: a.headline ?? a.title ?? "Untitled",
      url: a.url ?? null,
    }));

    const skills = toArray(d.skills)
      .map((s: any) => (typeof s === "string" ? s : s.name ?? ""))
      .filter(Boolean);

    console.log(`[LinkedIn] exp: ${experience.length}, edu: ${education.length}, articles: ${articles.length}, skills: ${skills.length}`);

    return {
      platform: "linkedin",
      name: d.name,
      headline: d.headline ?? null,
      summary: d.about ?? null,
      location: d.location ?? null,
      profileImageUrl: d.image ?? d.profilePicture ?? null,
      profileUrl: `https://www.linkedin.com/in/${username}/`,
      currentRole: experience[0]
        ? `${experience[0].title} at ${experience[0].company}`
        : d.headline ?? null,
      experience,
      education,
      skills,
      articles,
      connectionsCount: d.followers ? String(d.followers) : null,
      website: d.website ?? null,
    };
  } catch (err: any) {
    console.log(`[LinkedIn] Error ${err?.response?.status}:`, JSON.stringify(err?.response?.data));
    console.log(`[LinkedIn] Message: ${err?.message}`);
    if (err?.response?.status === 404) return { error: `Profile '${username}' not found or is private.` };
    if (err?.response?.status === 429) return { error: "Rate limit hit. Try again later." };
    if (err?.response?.status === 401) return { error: "Invalid API key. Check SOCIAVAULT_API_KEY." };
    return { error: `Failed to fetch LinkedIn data: ${err?.message}` };
  }
}


