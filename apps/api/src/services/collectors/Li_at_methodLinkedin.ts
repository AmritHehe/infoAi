import { PlaywrightCrawler , Configuration} from "crawlee";
import { MemoryStorage } from "@crawlee/memory-storage";
import type { LinkedInProfile } from "../../types";

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
  const url = `https://www.linkedin.com/in/${username}/`;
  let result: LinkedInProfile | { error: string } | null = null;

  const liAt = process.env.LINKEDIN_LI_AT;
  if (!liAt) throw new Error("LINKEDIN_LI_AT is not set in .env");

  console.log(`[LinkedIn] Scraping: ${url}`);

  const config = new Configuration({
    storageClient: new MemoryStorage(),
  });

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1,
    maxRequestRetries: 0,           // ← fail fast, no retries
    requestHandlerTimeoutSecs: 65,  // ← kill handler after 55s
    navigationTimeoutSecs: 30,      // ← kill page load after 30s , // ← no disk state, fresh every run

    launchContext: {
      launchOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      },
    } ,

    preNavigationHooks: [
      async ({ page }) => {
        await page.context().addCookies([{
          name: "li_at",
          value: liAt,
          domain: ".linkedin.com",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "None",
        }]);
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => undefined });
          (window as any).chrome = { runtime: {} };
        });
        await page.setViewportSize({ width: 1440, height: 900 });
      },
    ],

    async requestHandler({ page }) {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      console.log(`[LinkedIn] Landed: ${finalUrl}`);

      if (
        finalUrl.includes("/login") ||
        finalUrl.includes("/authwall") ||
        finalUrl.includes("/checkpoint")
      ) {
        result = { error: `li_at cookie expired. Please refresh it from your browser.` };
        return;
      }

      // Scroll to trigger lazy loading
      for (const pos of [500, 1200, 2000, 3000, 4000, 5000]) {
        await page.evaluate((y) => window.scrollTo(0, y), pos);
        await page.waitForTimeout(600);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      const scraped = await page.evaluate(() => {
        const bodyLines = document.body.innerText
          .split("\n")
          .map(l => l.trim())
          .filter(l => l.length > 0);

        const allH2s = Array.from(document.querySelectorAll("h2"));

        // ── Name ──
        const skipWords = [
          "notification", "About", "Activity", "Education", "Experience",
          "Skills", "Projects", "Interests", "People", "might", "Ad ",
          "Don't", "LinkedIn",
        ];
        const nameH2 = allH2s.find(h => {
          const t = h.textContent?.trim() ?? "";
          return t.length > 2 && !skipWords.some(w => t.includes(w));
        });
        const name = nameH2?.textContent?.trim() ?? null;

        // ── Headline ──
        const nameIdx = bodyLines.findIndex(l => l === name);
        const headline = nameIdx >= 0
          ? bodyLines.slice(nameIdx + 1).find(l =>
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

        // ── Location ──
        const locationKeywords = [
          "Area", "India", "Delhi", "Mumbai", "Bangalore",
          "Hyderabad", "Pune", "Chennai", "Kolkata", "Noida",
          "Gurgaon", "Gurugram", "Bengaluru",
        ];
        const location = bodyLines.find(l =>
          locationKeywords.some(k => l.includes(k)) && l.length < 60
        ) ?? null;

        // ── Profile image ──
        const allImgs = Array.from(document.querySelectorAll("img"));
        const profileImgs = allImgs.filter(img =>
          img.src.includes("media.licdn.com") &&
          img.src.includes("profile-displayphoto")
        );
        profileImgs.sort((a, b) => (b.naturalWidth ?? 0) - (a.naturalWidth ?? 0));
        const image = profileImgs[0]?.src ?? null;

        // ── About ──
        const aboutH2 = allH2s.find(h => h.textContent?.trim() === "About");
        let aboutContainer: Element | null = aboutH2 ?? null;
        for (let i = 0; i < 6; i++) {
          aboutContainer = aboutContainer?.parentElement ?? null;
          if (aboutContainer?.tagName.toLowerCase() === "section") break;
        }
        const aboutSpans = aboutContainer
          ? Array.from(aboutContainer.querySelectorAll("span, p"))
              .map(el => el.textContent?.trim() ?? "")
              .filter(t =>
                t.length > 10 &&
                t !== "About" &&
                !t.includes("Top skills") &&
                !t.includes("•")
              )
          : [];
        const about = aboutSpans[0] ?? null;

        // ── Section parser ──
        const targetSections = ["Experience", "Education", "Skills", "Projects"];
        const sectionStarts: { name: string; idx: number }[] = [];
        bodyLines.forEach((line, idx) => {
          if (
            targetSections.includes(line) &&
            !sectionStarts.find(s => s.name === line)
          ) {
            sectionStarts.push({ name: line, idx });
          }
        });

        const getSectionLines = (sectionName: string): string[] => {
          const section = sectionStarts.find(s => s.name === sectionName);
          if (!section) return [];
          const nextSection = sectionStarts.find(s => s.idx > section.idx);
          const endIdx = nextSection ? nextSection.idx : section.idx + 40;
          return bodyLines.slice(section.idx + 1, endIdx);
        };

        // ── Education ──
        const rawEduLines = getSectionLines("Education");
        const cleanEduLines = rawEduLines.filter(l =>
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
          if (!school || school.length < 3) { i++; continue; }
          const degree = cleanEduLines[i + 1] ?? null;
          const hasYear = cleanEduLines[i + 2]?.match(/\d{4}/);
          const years = hasYear ? cleanEduLines[i + 2] : null;
          education.push({ school, degree, years });
          i += years ? 3 : 2;
        }

        // ── Experience ──
        const rawExpLines = getSectionLines("Experience");
        const cleanExpLines = rawExpLines.filter(l =>
          l.length > 2 &&
          !l.includes("follower") &&
          !l.includes("Show all") &&
          !l.match(/^\d{1,3}(,\d{3})*$/)
        );
        const experience: { title: string; company: string | null; duration: string | null }[] = [];
        let j = 0;
        while (j < cleanExpLines.length && experience.length < 10) {
          const title = cleanExpLines[j];
          if (!title || title.length < 2) { j++; continue; }
          const company = cleanExpLines[j + 1] ?? null;
          const hasDuration = cleanExpLines[j + 2]?.match(/\d{4}|Present|mo |yr /);
          const duration = hasDuration ? cleanExpLines[j + 2] : null;
          experience.push({ title, company, duration });
          j += duration ? 3 : 2;
        }

        // ── Skills ──
        const rawSkillLines = getSectionLines("Skills");
        const hardStopWords = [
          "Interests", "Top Voices", "Companies", "Schools",
          "People you may know", "More profiles", "· 3rd+", "Connect", "Follow",
        ];
        const stopIdx = rawSkillLines.findIndex(l =>
          hardStopWords.some(w => l.includes(w))
        );
        const skills = [...new Set(
          rawSkillLines
            .slice(0, stopIdx > 0 ? stopIdx : rawSkillLines.length)
            .filter(l =>
              l.length > 1 &&
              l.length < 50 &&
              !l.includes("Show all") &&
              !l.includes("endorsed") &&
              !l.includes("follower")
            )
        )].slice(0, 20);

        return { name, headline, location, image, about, experience, education, skills };
      });

      console.log(`[LinkedIn] name: "${scraped.name}", headline: "${scraped.headline}"`);
      console.log(`[LinkedIn] exp: ${scraped.experience.length}, edu: ${scraped.education.length}, skills: ${scraped.skills.length}`);

      if (!scraped.name) {
        result = { error: `Could not scrape '${username}'.` };
        return;
      }

      const experience = scraped.experience.map(e => ({
        title: e.title,
        company: e.company ?? "Unknown",
        duration: e.duration ?? null,
        description: null,
      }));

      const education = scraped.education.map(e => ({
        school: e.school,
        degree: e.degree ?? null,
        field: null,
        years: e.years ?? null,
      }));

      result = {
        platform: "linkedin",
        name: scraped.name,
        headline: scraped.headline ?? null,
        summary: scraped.about ?? null,
        location: scraped.location ?? null,
        profileImageUrl: scraped.image ?? null,
        profileUrl: url,
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
    },

    failedRequestHandler({ error }: any) {
      console.log(`[LinkedIn] Failed: ${error.message}`);
      result = { error: `Scraping failed: ${error.message}` };
    },
  }, config);

  // ← Hard 60s timeout — if crawler hangs, resolve with error
  const timeoutPromise = new Promise<LinkedInProfile | { error: string }>(
    (resolve) =>
      setTimeout(
        () => resolve({ error: "LinkedIn scraping timed out after 60s. Please try again." }),
        70000
      )
  );

  const crawlerPromise = crawler
    .run([{ url }])
    .then(() => result ?? { error: "No result returned from crawler." });

  return Promise.race([crawlerPromise, timeoutPromise]);
}