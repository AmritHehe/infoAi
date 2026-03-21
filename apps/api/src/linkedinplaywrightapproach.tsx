import { PlaywrightCrawler } from "crawlee";
import type { LinkedInProfile } from "./types";

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

  console.log(`[LinkedIn] Crawlee scraping: ${url}`);

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1,
    requestHandlerTimeoutSecs: 45,
    launchContext: {
      launchOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      },
    },

    async requestHandler({ page }) {
      await page.waitForLoadState("domcontentloaded");

      // Check for auth wall
      const currentUrl = page.url();
      console.log(`[LinkedIn] Landed on: ${currentUrl}`);

      if (
        currentUrl.includes("/login") ||
        currentUrl.includes("/authwall") ||
        currentUrl.includes("/checkpoint")
      ) {
        result = { error: `Profile '${username}' is private or requires login.` };
        return;
      }

      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);

      const data = await page.evaluate(() => {
        const getText = (selectors: string[]): string | null => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el?.textContent?.trim()) return el.textContent.trim();
          }
          return null;
        };

        const getImg = (selectors: string[]): string | null => {
          for (const sel of selectors) {
            const el = document.querySelector(sel) as HTMLImageElement;
            if (el?.src) return el.src;
          }
          return null;
        };

        // Name
        const name = getText([
          "h1.top-card-layout__title",
          "h1.text-heading-xlarge",
          "h1",
        ]);

        // Headline
        const headline = getText([
          ".top-card-layout__headline",
          ".text-body-medium.break-words",
          ".ph5 .mt2 .text-body-medium",
        ]);

        // Location
        const location = getText([
          ".top-card__subline-item",
          ".text-body-small.inline.t-black--light.break-words",
          ".pb2 .text-body-small",
        ]);

        // Profile image
        const image = getImg([
          ".top-card__profile-image",
          ".pv-top-card-profile-picture__image",
          "img.profile-photo-edit__preview",
          ".presence-entity__image",
        ]);

        // About
        const about = getText([
          ".core-section-container__content .full-width",
          "#about ~ .pvs-list__outer-container p",
          ".pv-about-section p",
        ]);

        // Experience
        const expEls = Array.from(
          document.querySelectorAll([
            "#experience ~ .pvs-list__outer-container li",
            ".experience-section li",
            ".pv-experience-section li",
          ].join(", "))
        );

        const experience = expEls.slice(0, 10).map((el) => ({
          title: getText([
            ".mr1.t-bold span",
            ".t-14.t-bold span",
          ].map(s => `#${el.id ?? ""} ${s}`)) ??
            el.querySelector(".mr1.t-bold span, .t-14.t-bold span")?.textContent?.trim() ?? null,
          company:
            el.querySelector(".t-14.t-normal span, .pv-entity__secondary-title")?.textContent?.trim() ?? null,
          duration:
            el.querySelector(".pvs-entity__caption-wrapper, .pv-entity__date-range span:nth-child(2)")?.textContent?.trim() ?? null,
        }));

        // Education
        const eduEls = Array.from(
          document.querySelectorAll([
            "#education ~ .pvs-list__outer-container li",
            ".education-section li",
            ".pv-education-section li",
          ].join(", "))
        );

        const education = eduEls.slice(0, 5).map((el) => ({
          school:
            el.querySelector(".mr1.t-bold span, .pv-entity__school-name")?.textContent?.trim() ?? null,
          degree:
            el.querySelector(".t-14.t-normal span, .pv-entity__degree-name span")?.textContent?.trim() ?? null,
          years:
            el.querySelector(".pvs-entity__caption-wrapper, .pv-entity__dates span:nth-child(2)")?.textContent?.trim() ?? null,
        }));

        // Skills
        const skillEls = Array.from(
          document.querySelectorAll([
            "#skills ~ .pvs-list__outer-container li .mr1.t-bold span",
            ".pv-skill-category-entity__name",
          ].join(", "))
        );
        const skills = skillEls
          .map((el) => el.textContent?.trim())
          .filter(Boolean) as string[];

        return { name, headline, location, image, about, experience, education, skills };
      });

      console.log(`[LinkedIn] Raw scraped data:`, JSON.stringify(data, null, 2));

      if (!data.name) {
        result = { error: `Could not scrape '${username}' — profile may be private or LinkedIn changed their HTML.` };
        return;
      }

      const experience = data.experience
        .filter((e) => e.title || e.company)
        .map((e) => ({
          title: e.title ?? "Unknown Role",
          company: e.company ?? "Unknown",
          duration: e.duration ?? null,
          description: null,
        }));

      const education = data.education
        .filter((e) => e.school)
        .map((e) => ({
          school: e.school ?? "Unknown",
          degree: e.degree ?? null,
          field: null,
          years: e.years ?? null,
        }));

      console.log(`[LinkedIn] ✅ ${data.name} — exp: ${experience.length}, edu: ${education.length}, skills: ${data.skills.length}`);

      result = {
        platform: "linkedin",
        name: data.name,
        headline: data.headline ?? null,
        summary: data.about ?? null,
        location: data.location ?? null,
        profileImageUrl: data.image ?? null,
        profileUrl: url,
        currentRole: experience[0]
          ? `${experience[0].title} at ${experience[0].company}`
          : data.headline ?? null,
        experience,
        education,
        skills: data.skills,
        articles: [],
        connectionsCount: null,
        website: null,
      };
    },

    failedRequestHandler({ error }) {
        //@ts-ignore
      console.log(`[LinkedIn] Crawlee failed: ${error.message}`);
      //@ts-ignore
      result = { error: `Scraping failed: ${error.message}` };
    },
  });

  await crawler.run([{ url }]);

  return result ?? { error: "No result — crawler may have timed out." };
}