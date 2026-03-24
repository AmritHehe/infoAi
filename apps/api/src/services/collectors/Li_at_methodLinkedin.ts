import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { LinkedInProfile } from "../../types";

const LINKEDIN_LOGIN_URL = "https://www.linkedin.com/login";
const API_ROOT = process.cwd().endsWith("/apps/api")
  ? process.cwd()
  : path.resolve(process.cwd(), "apps/api");
const DEFAULT_COOKIE_STORE_PATH = path.resolve(API_ROOT, ".storage/linkedin-li-at.json");
const DEFAULT_FAILURE_SCREENSHOT_DIR = path.resolve(API_ROOT, ".storage/linkedin-failures");

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

function logLinkedIn(step: string, details?: string): void {
  const now = new Date().toISOString();
  if (details) {
    console.log(`[LinkedIn][${now}][${step}] ${details}`);
    return;
  }
  console.log(`[LinkedIn][${now}][${step}]`);
}

function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "null";
  if (secret.length <= 8) return `${secret.slice(0, 2)}***`;
  return `${secret.slice(0, 4)}***${secret.slice(-4)}`;
}

function getFailureScreenshotDir(): string {
  return (
    process.env.LINKEDIN_FAILURE_SCREENSHOT_DIR?.trim() || DEFAULT_FAILURE_SCREENSHOT_DIR
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function saveFailureScreenshot(page: Page, reason: string): Promise<void> {
  try {
    const dir = getFailureScreenshotDir();
    await mkdir(dir, { recursive: true });
    const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.resolve(
      dir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeReason}.png`
    );
    await withTimeout(page.screenshot({ path: filePath, fullPage: true }), 5_000, "screenshot");
    logLinkedIn("FAILURE_SCREENSHOT_SAVED", `path=${filePath}`);
  } catch (error: any) {
    logLinkedIn("FAILURE_SCREENSHOT_ERROR", error?.message ?? String(error));
  }
}

function getCookieStorePath(): string {
  return process.env.LINKEDIN_COOKIE_STORE_PATH?.trim() || DEFAULT_COOKIE_STORE_PATH;
}

async function readStoredLiAt(): Promise<string | null> {
  const cookieStorePath = getCookieStorePath();
  logLinkedIn("COOKIE_READ_START", `path=${cookieStorePath}`);
  try {
    const raw = await readFile(cookieStorePath, "utf-8");
    const parsed = JSON.parse(raw) as { liAt?: string };
    const liAt = parsed.liAt?.trim();
    logLinkedIn("COOKIE_READ_OK", `found=${Boolean(liAt)} value=${maskSecret(liAt)}`);
    return liAt || null;
  } catch {
    logLinkedIn("COOKIE_READ_MISS", `path=${cookieStorePath}`);
    return null;
  }
}

async function persistLiAt(liAt: string): Promise<void> {
  const cookieStorePath = getCookieStorePath();
  logLinkedIn("COOKIE_WRITE_START", `path=${cookieStorePath} value=${maskSecret(liAt)}`);
  await mkdir(path.dirname(cookieStorePath), { recursive: true });
  await writeFile(
    cookieStorePath,
    JSON.stringify({ liAt, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
  logLinkedIn("COOKIE_WRITE_DONE", `path=${cookieStorePath}`);
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
  logLinkedIn(
    "SESSION_CREATE_START",
    `withCookie=${Boolean(liAt)} cookie=${maskSecret(liAt)}`
  );
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
    logLinkedIn("SESSION_COOKIE_INJECT");
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

  logLinkedIn("SESSION_CREATE_DONE");
  return { browser, context, page };
}

async function closeSession(
  browser: { close: () => Promise<void> } | null,
  context: BrowserContext | null,
  page: Page | null
): Promise<void> {
  logLinkedIn("SESSION_CLOSE_START");
  try {
    if (page) await withTimeout(page.close({ runBeforeUnload: false }), 5_000, "page.close");
  } catch (error: any) {
    logLinkedIn("SESSION_CLOSE_WARN", `page=${error?.message ?? String(error)}`);
  }
  try {
    if (context) await withTimeout(context.close(), 5_000, "context.close");
  } catch (error: any) {
    logLinkedIn("SESSION_CLOSE_WARN", `context=${error?.message ?? String(error)}`);
  }
  try {
    if (browser) await withTimeout(browser.close(), 8_000, "browser.close");
  } catch (error: any) {
    logLinkedIn("SESSION_CLOSE_WARN", `browser=${error?.message ?? String(error)}`);
  }
  logLinkedIn("SESSION_CLOSE_DONE");
}

async function performPageScrape(page: Page, profileUrl: string): Promise<ScrapeAttempt> {
  logLinkedIn("SCRAPE_NAVIGATE_START", `url=${profileUrl}`);
  try {
    await withTimeout(
      page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 25_000 }),
      27_000,
      "profile navigation"
    );
  } catch (error: any) {
    const message = error?.message ?? String(error);
    logLinkedIn("SCRAPE_NAVIGATE_ERROR", message);
    await saveFailureScreenshot(page, "scrape_navigate_error");
    if (
      message.includes("ERR_TOO_MANY_REDIRECTS") ||
      message.includes("Timeout") ||
      message.includes("timed out")
    ) {
      return {
        ok: false,
        reason: "auth",
        message: "Profile navigation blocked/timed out (likely challenge or rate limit).",
      };
    }
    return {
      ok: false,
      reason: "failed",
      message: `Profile navigation failed: ${message}`,
    };
  }
  await page.waitForTimeout(2_000);

  const landedUrl = page.url();
  logLinkedIn("SCRAPE_NAVIGATE_DONE", `landedUrl=${landedUrl}`);

  if (isAuthPage(landedUrl)) {
    logLinkedIn("SCRAPE_AUTH_REDIRECT", `url=${landedUrl}`);
    await saveFailureScreenshot(page, "scrape_auth_redirect");
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
  logLinkedIn("SCRAPE_SCROLL_DONE");
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

  logLinkedIn(
    "SCRAPE_PARSE_SUMMARY",
    `name=${scraped.name ?? "null"} headline=${scraped.headline ?? "null"} exp=${scraped.experience.length} edu=${scraped.education.length} skills=${scraped.skills.length}`
  );

  if (!scraped.name) {
    logLinkedIn("SCRAPE_PARSE_FAIL", "missing name");
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
  logLinkedIn("LOGIN_START", `url=${LINKEDIN_LOGIN_URL}`);
  await withTimeout(
    page.goto(LINKEDIN_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 25_000 }),
    27_000,
    "login navigation"
  );
  logLinkedIn("LOGIN_PAGE_LOADED", `landedUrl=${page.url()}`);
  await page.waitForSelector("#username", { timeout: 15_000 });
  logLinkedIn("LOGIN_FORM_FOUND", "selectors=#username,#password");
  await page.fill("#username", email);
  logLinkedIn("LOGIN_USER_FILLED");
  await page.fill("#password", password);
  logLinkedIn("LOGIN_PASSWORD_FILLED");
  await page.click("button[type='submit']");
  logLinkedIn("LOGIN_SUBMITTED");
  await page.waitForTimeout(7_000);

  const currentUrl = page.url();
  logLinkedIn("LOGIN_POST_SUBMIT_URL", `url=${currentUrl}`);
  if (isAuthPage(currentUrl)) {
    logLinkedIn("LOGIN_AUTH_REDIRECT", `url=${currentUrl}`);
    await saveFailureScreenshot(page, "login_auth_redirect");
    return null;
  }

  const cookies = await context.cookies("https://www.linkedin.com");
  const liAtCookie = cookies.find((cookie) => cookie.name === "li_at")?.value ?? null;
  logLinkedIn("LOGIN_COOKIE_EXTRACT", `found=${Boolean(liAtCookie)} value=${maskSecret(liAtCookie)}`);
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

  logLinkedIn("COLLECT_START", `profileUrl=${profileUrl}`);

  const storedLiAt = await readStoredLiAt();
  const envLiAt = process.env.LINKEDIN_LI_AT ?? null;
  const cookieCandidates = normalizeCookieCandidates([storedLiAt, envLiAt]);
  logLinkedIn(
    "COOKIE_CANDIDATES_READY",
    `count=${cookieCandidates.length} stored=${Boolean(storedLiAt)} env=${Boolean(envLiAt)}`
  );

  for (const [index, candidate] of cookieCandidates.entries()) {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      logLinkedIn(
        "COOKIE_ATTEMPT_START",
        `attempt=${index + 1}/${cookieCandidates.length} cookie=${maskSecret(candidate)}`
      );
      const session = await createSession(candidate);
      browser = session.browser;
      context = session.context;
      page = session.page;

      const attempt = await performPageScrape(page, profileUrl);
      if (attempt.ok) {
        logLinkedIn("COOKIE_ATTEMPT_SUCCESS", `attempt=${index + 1}`);
        await persistLiAt(candidate);
        return buildLinkedInProfile(attempt.payload, profileUrl);
      }

      if (attempt.reason !== "auth") {
        logLinkedIn("COOKIE_ATTEMPT_FAIL_NON_AUTH", `attempt=${index + 1} message=${attempt.message}`);
        return { error: attempt.message };
      }

      logLinkedIn("COOKIE_ATTEMPT_FAIL_AUTH", `attempt=${index + 1} message=${attempt.message}`);
    } catch (error: any) {
      logLinkedIn("COOKIE_ATTEMPT_ERROR", `attempt=${index + 1} error=${error?.message ?? String(error)}`);
    } finally {
      await closeSession(browser, context, page);
    }
  }

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  if (!email || !password) {
    logLinkedIn("LOGIN_CREDENTIALS_MISSING");
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

    logLinkedIn("LOGIN_REFRESH_ATTEMPT");
    const freshLiAt = await loginAndExtractLiAt(page, context, email, password);

    if (!freshLiAt) {
      logLinkedIn("LOGIN_REFRESH_FAILED");
      return {
        error: "LinkedIn login failed (likely checkpoint/CAPTCHA). Could not refresh li_at.",
      };
    }

    await persistLiAt(freshLiAt);
    logLinkedIn("LOGIN_REFRESH_SUCCESS", `cookiePath=${getCookieStorePath()}`);

    const scrapeAttempt = await performPageScrape(page, profileUrl);
    if (!scrapeAttempt.ok) {
      logLinkedIn("POST_LOGIN_SCRAPE_FAILED", scrapeAttempt.message);
      return { error: scrapeAttempt.message };
    }

    logLinkedIn("COLLECT_SUCCESS");
    return buildLinkedInProfile(scrapeAttempt.payload, profileUrl);
  } catch (error: any) {
    logLinkedIn("COLLECT_FATAL_ERROR", error?.message ?? String(error));
    if (page) {
      await saveFailureScreenshot(page, "collect_fatal_error");
    }
    return { error: `LinkedIn scraping failed: ${error?.message ?? String(error)}` };
  } finally {
    await closeSession(browser, context, page);
  }
}
