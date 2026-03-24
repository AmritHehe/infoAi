import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { LinkedInProfile } from "../../types";

const LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login";
const DEFAULT_COOKIE_STORE_PATH = path.resolve(
  process.cwd(),
  "apps/api/.storage/linkedin-li-at.json"
);

type ScrapedPayload = {
  name: string | null;
  headline: string | null;
  location: string | null;
  image: string | null;
  about: string | null;
  experience: { title: string; company: string | null; duration: string | null }[];
  education: { school: string; degree: string | null; years: string | null }[];
  skills: string[];
};

type ScrapeAttempt =
  | { ok: true; payload: ScrapedPayload }
  | { ok: false; reason: "auth" | "not-found" | "failed"; message: string };

function getCookieStorePath(): string {
  return process.env.LINKEDIN_COOKIE_STORE_PATH?.trim() || DEFAULT_COOKIE_STORE_PATH;
}

async function readStoredLiAt(): Promise<string | null> {
  const cookieStorePath = getCookieStorePath();
  try {
    const raw = await readFile(cookieStorePath, "utf-8");
    const parsed = JSON.parse(raw) as { liAt?: string };
    const liAt = parsed.liAt?.trim();
    return liAt || null;
  } catch {
    return null;
  }
}

async function persistLiAt(liAt: string): Promise<void> {
  const cookieStorePath = getCookieStorePath();
  await mkdir(path.dirname(cookieStorePath), { recursive: true });
  await writeFile(
    cookieStorePath,
    JSON.stringify({ liAt, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

function isAuthPage(url: string): boolean {
  return (
    url.includes("/login") ||
    url.includes("/authwall") ||
    url.includes("/checkpoint")
  );
}

function normalizeCookieCandidates(candidates: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const item of candidates) {
    const val = item?.trim();
    if (val) unique.add(val);
  }
  return [...unique];
}

async function createSession(liAt?: string) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  if (liAt) {
    await context.addCookies([
      {
        name: "li_at",
        value: liAt,
        domain: ".linkedin.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
    ]);
  }

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(30_000);
  page.setDefaultTimeout(30_000);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as Window & { chrome?: { runtime: object } }).chrome = { runtime: {} };
  });

  return { browser, context, page };
}

async function closeSession(
  browser: { close: () => Promise<void> } | null,
  context: BrowserContext | null,
  page: Page | null
): Promise<void> {
  try {
    await page?.close({ runBeforeUnload: false });
  } catch {}
  try {
    await context?.close();
  } catch {}
  try {
    await browser?.close();
  } catch {}
}

async function performPageScrape(page: Page, profileUrl: string): Promise<ScrapeAttempt> {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_000);

  const landedUrl = page.url();
  console.log(`[LinkedIn] Landed: ${landedUrl}`);

  if (isAuthPage(landedUrl)) {
    return {
      ok: false,
      reason: "auth",
      message: "LinkedIn redirected to login/authwall.",
    };
  }

  for (const pos of [500, 1200, 2000, 3000, 4000, 5000]) {
    await page.evaluate((y) => window.scrollTo(0, y), pos);
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const scraped = await page.evaluate(() => {
    const bodyLines = document.body.innerText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const allH2s = Array.from(document.querySelectorAll("h2"));

    const skipWords = [
      "notification",
      "About",
      "Activity",
      "Education",
      "Experience",
      "Skills",
      "Projects",
      "Interests",
      "People",
      "might",
      "Ad ",
      "Don't",
      "LinkedIn",
    ];

    const nameH2 = allH2s.find((h) => {
      const t = h.textContent?.trim() ?? "";
      return t.length > 2 && !skipWords.some((w) => t.includes(w));
    });
    const name = nameH2?.textContent?.trim() ?? null;

    const nameIdx = bodyLines.findIndex((l) => l === name);
    const headline =
      nameIdx >= 0
        ? bodyLines
            .slice(nameIdx + 1)
            .find(
              (l) =>
                l.length > 5 &&
                !["He/Him", "She/Her", "They/Them"].includes(l) &&
                !l.includes("Connect") &&
                !l.includes("Message") &&
                !l.includes("More") &&
                !l.includes("500+") &&
                !l.includes("connections") &&
                !l.includes("notification")
            ) ?? null
        : null;

    const locationKeywords = [
      "Area",
      "India",
      "Delhi",
      "Mumbai",
      "Bangalore",
      "Hyderabad",
      "Pune",
      "Chennai",
      "Kolkata",
      "Noida",
      "Gurgaon",
      "Gurugram",
      "Bengaluru",
    ];
    const location =
      bodyLines.find((l) => locationKeywords.some((k) => l.includes(k)) && l.length < 60) ??
      null;

    const allImgs = Array.from(document.querySelectorAll("img"));
    const profileImgs = allImgs.filter(
      (img) => img.src.includes("media.licdn.com") && img.src.includes("profile-displayphoto")
    );
    profileImgs.sort((a, b) => (b.naturalWidth ?? 0) - (a.naturalWidth ?? 0));
    const image = profileImgs[0]?.src ?? null;

    const aboutH2 = allH2s.find((h) => h.textContent?.trim() === "About");
    let aboutContainer: Element | null = aboutH2 ?? null;
    for (let i = 0; i < 6; i++) {
      aboutContainer = aboutContainer?.parentElement ?? null;
      if (aboutContainer?.tagName.toLowerCase() === "section") break;
    }
    const aboutSpans = aboutContainer
      ? Array.from(aboutContainer.querySelectorAll("span, p"))
          .map((el) => el.textContent?.trim() ?? "")
          .filter(
            (t) => t.length > 10 && t !== "About" && !t.includes("Top skills") && !t.includes("•")
          )
      : [];
    const about = aboutSpans[0] ?? null;

    const targetSections = ["Experience", "Education", "Skills", "Projects"];
    const sectionStarts: { name: string; idx: number }[] = [];
    bodyLines.forEach((line, idx) => {
      if (targetSections.includes(line) && !sectionStarts.find((s) => s.name === line)) {
        sectionStarts.push({ name: line, idx });
      }
    });

    const getSectionLines = (sectionName: string): string[] => {
      const section = sectionStarts.find((s) => s.name === sectionName);
      if (!section) return [];
      const nextSection = sectionStarts.find((s) => s.idx > section.idx);
      const endIdx = nextSection ? nextSection.idx : section.idx + 40;
      return bodyLines.slice(section.idx + 1, endIdx);
    };

    const rawEduLines = getSectionLines("Education");
    const cleanEduLines = rawEduLines.filter(
      (l) =>
        l.length > 2 &&
        !l.includes("follower") &&
        !l.includes("alumni") &&
        !l.includes("Follow") &&
        !l.includes("Show all") &&
        !l.match(/^\d{1,3}(,\d{3})*$/)
    );

    const education: { school: string; degree: string | null; years: string | null }[] = [];
    let i = 0;
    while (i < cleanEduLines.length && education.length < 5) {
      const school = cleanEduLines[i];
      if (!school || school.length < 3) {
        i++;
        continue;
      }
      const degree = cleanEduLines[i + 1] ?? null;
      const hasYear = cleanEduLines[i + 2]?.match(/\d{4}/);
      const years = hasYear ? cleanEduLines[i + 2] : null;
      education.push({ school, degree, years });
      i += years ? 3 : 2;
    }

    const rawExpLines = getSectionLines("Experience");
    const cleanExpLines = rawExpLines.filter(
      (l) =>
        l.length > 2 &&
        !l.includes("follower") &&
        !l.includes("Show all") &&
        !l.match(/^\d{1,3}(,\d{3})*$/)
    );

    const experience: { title: string; company: string | null; duration: string | null }[] = [];
    let j = 0;
    while (j < cleanExpLines.length && experience.length < 10) {
      const title = cleanExpLines[j];
      if (!title || title.length < 2) {
        j++;
        continue;
      }
      const company = cleanExpLines[j + 1] ?? null;
      const hasDuration = cleanExpLines[j + 2]?.match(/\d{4}|Present|mo |yr /);
      const duration = hasDuration ? cleanExpLines[j + 2] : null;
      experience.push({ title, company, duration });
      j += duration ? 3 : 2;
    }

    const rawSkillLines = getSectionLines("Skills");
    const hardStopWords = [
      "Interests",
      "Top Voices",
      "Companies",
      "Schools",
      "People you may know",
      "More profiles",
      "· 3rd+",
      "Connect",
      "Follow",
    ];
    const stopIdx = rawSkillLines.findIndex((l) => hardStopWords.some((w) => l.includes(w)));
    const skills = [
      ...new Set(
        rawSkillLines
          .slice(0, stopIdx > 0 ? stopIdx : rawSkillLines.length)
          .filter(
            (l) =>
              l.length > 1 &&
              l.length < 50 &&
              !l.includes("Show all") &&
              !l.includes("endorsed") &&
              !l.includes("follower")
          )
      ),
    ].slice(0, 20);

    return { name, headline, location, image, about, experience, education, skills };
  });

  console.log(`[LinkedIn] name: "${scraped.name}", headline: "${scraped.headline}"`);
  console.log(
    `[LinkedIn] exp: ${scraped.experience.length}, edu: ${scraped.education.length}, skills: ${scraped.skills.length}`
  );

  if (!scraped.name) {
    return {
      ok: false,
      reason: "not-found",
      message: "Could not extract profile name from page content.",
    };
  }

  return { ok: true, payload: scraped };
}

async function loginAndExtractLiAt(
  page: Page,
  context: BrowserContext,
  email: string,
  password: string
): Promise<string | null> {
  await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#username", { timeout: 15_000 });
  await page.fill("#username", email);
  await page.fill("#password", password);
  await page.click("button[type='submit']");
  await page.waitForTimeout(7_000);

  const currentUrl = page.url();
  if (isAuthPage(currentUrl)) {
    return null;
  }

  const cookies = await context.cookies("https://www.linkedin.com");
  const liAtCookie = cookies.find((cookie) => cookie.name === "li_at")?.value ?? null;
  return liAtCookie;
}

function buildLinkedInProfile(
  scraped: ScrapedPayload,
  profileUrl: string
): LinkedInProfile {
  const experience = scraped.experience.map((e) => ({
    title: e.title,
    company: e.company ?? "Unknown",
    duration: e.duration ?? null,
    description: null,
  }));

  const education = scraped.education.map((e) => ({
    school: e.school,
    degree: e.degree ?? null,
    field: null,
    years: e.years ?? null,
  }));

  return {
    platform: "linkedin",
    name: scraped.name!,
    headline: scraped.headline ?? null,
    summary: scraped.about ?? null,
    location: scraped.location ?? null,
    profileImageUrl: scraped.image ?? null,
    profileUrl,
    currentRole: experience[0]
      ? `${experience[0].title} at ${experience[0].company}`
      : scraped.headline ?? null,
    experience,
    education,
    skills: scraped.skills,
    articles: [],
    connectionsCount: null,
    website: null,
  };
}

export function extractUsername(urlOrHandle: string): string {
  try {
    if (urlOrHandle.includes("linkedin.com")) {
      const url = new URL(
        urlOrHandle.startsWith("http") ? urlOrHandle : `https://${urlOrHandle}`
      );
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("in");
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {}
  return urlOrHandle.replace(/^\/|\/$/g, "").trim();
}

export async function collectLinkedInProfile(
  urlOrHandle: string
): Promise<LinkedInProfile | { error: string }> {
  const username = extractUsername(urlOrHandle);
  const profileUrl = `https://www.linkedin.com/in/${username}/`;

  console.log(`[LinkedIn] Scraping: ${profileUrl}`);

  const storedLiAt = await readStoredLiAt();
  const envLiAt = process.env.LINKEDIN_LI_AT ?? null;
  const cookieCandidates = normalizeCookieCandidates([storedLiAt, envLiAt]);

  for (const candidate of cookieCandidates) {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      const session = await createSession(candidate);
      browser = session.browser;
      context = session.context;
      page = session.page;

      const attempt = await performPageScrape(page, profileUrl);
      if (attempt.ok) {
        await persistLiAt(candidate);
        return buildLinkedInProfile(attempt.payload, profileUrl);
      }

      if (attempt.reason !== "auth") {
        return { error: attempt.message };
      }

      console.log("[LinkedIn] Stored/env cookie invalid. Trying next candidate...");
    } catch (error: any) {
      console.log(`[LinkedIn] Cookie attempt failed: ${error?.message ?? String(error)}`);
    } finally {
      await closeSession(browser, context, page);
    }
  }

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  if (!email || !password) {
    return {
      error:
        "No valid stored cookie found. Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD to refresh li_at automatically.",
    };
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const session = await createSession();
    browser = session.browser;
    context = session.context;
    page = session.page;

    console.log("[LinkedIn] Attempting credential login to refresh li_at...");
    const freshLiAt = await loginAndExtractLiAt(page, context, email, password);

    if (!freshLiAt) {
      return {
        error: "LinkedIn login failed (likely checkpoint/CAPTCHA). Could not refresh li_at.",
      };
    }

    await persistLiAt(freshLiAt);
    console.log(`[LinkedIn] Saved fresh li_at to ${getCookieStorePath()}`);

    const scrapeAttempt = await performPageScrape(page, profileUrl);
    if (!scrapeAttempt.ok) {
      return { error: scrapeAttempt.message };
    }

    return buildLinkedInProfile(scrapeAttempt.payload, profileUrl);
  } catch (error: any) {
    return { error: `LinkedIn scraping failed: ${error?.message ?? String(error)}` };
  } finally {
    await closeSession(browser, context, page);
  }
}
