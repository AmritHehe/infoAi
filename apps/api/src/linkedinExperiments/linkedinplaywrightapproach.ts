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

  // ← use in.linkedin.com subdomain which serves public profiles without auth wall
  const url = `https://in.linkedin.com/in/${username}/`;
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

      await page.waitForTimeout(3000);

      // Take a screenshot to debug what's actually rendered
      await page.screenshot({ path: `linkedin-debug-${username}.png` });
      console.log(`[LinkedIn] Screenshot saved: linkedin-debug-${username}.png`);

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

        // dump all h1s and key elements for debugging
        const allH1s = Array.from(document.querySelectorAll("h1")).map(
          (el) => el.textContent?.trim()
        );
        const allClasses = Array.from(document.querySelectorAll("[class]"))
          .slice(0, 30)
          .map((el) => el.className);

        const name = getText([
          "h1.top-card-layout__title",
          "h1.text-heading-xlarge",
          ".top-card-layout__title",
          "h1",
        ]);

        const headline = getText([
          ".top-card-layout__headline",
          ".top-card__subline-item",
          ".text-body-medium.break-words",
        ]);

        const location = getText([
          ".top-card__subline-item:nth-child(2)",
          ".text-body-small.inline.t-black--light.break-words",
          ".top-card-layout__first-subline",
        ]);

        const image = getImg([
          ".top-card__profile-image",
          ".pv-top-card-profile-picture__image",
          ".profile-photo-edit__preview",
          "img[alt*='photo']",
          "img[alt*='profile']",
        ]);

        const about = getText([
          ".core-section-container__content .full-width",
          ".top-card-layout__summary",
          ".pv-about-section p",
        ]);

        const expEls = Array.from(
          document.querySelectorAll(
            "#experience ~ .pvs-list__outer-container li, .experience-section li, .pv-experience-section li"
          )
        );

        const experience = expEls.slice(0, 10).map((el) => ({
          title:
            el.querySelector(".mr1.t-bold span, .t-14.t-bold span")?.textContent?.trim() ?? null,
          company:
            el.querySelector(".t-14.t-normal span, .pv-entity__secondary-title")?.textContent?.trim() ?? null,
          duration:
            el.querySelector(".pvs-entity__caption-wrapper, .pv-entity__date-range span:nth-child(2)")?.textContent?.trim() ?? null,
        }));

        const eduEls = Array.from(
          document.querySelectorAll(
            "#education ~ .pvs-list__outer-container li, .education-section li"
          )
        );

        const education = eduEls.slice(0, 5).map((el) => ({
          school:
            el.querySelector(".mr1.t-bold span, .pv-entity__school-name")?.textContent?.trim() ?? null,
          degree:
            el.querySelector(".t-14.t-normal span, .pv-entity__degree-name span")?.textContent?.trim() ?? null,
          years:
            el.querySelector(".pvs-entity__caption-wrapper")?.textContent?.trim() ?? null,
        }));

        const skillEls = Array.from(
          document.querySelectorAll(
            "#skills ~ .pvs-list__outer-container li .mr1.t-bold span, .pv-skill-category-entity__name"
          )
        );
        const skills = skillEls
          .map((el) => el.textContent?.trim())
          .filter(Boolean) as string[];

        return {
          name, headline, location, image, about,
          experience, education, skills,
          // debug info
          _debug: { allH1s, bodyLength: document.body.innerHTML.length },
        };
      });

      console.log(`[LinkedIn] Debug H1s:`, data._debug.allH1s);
      console.log(`[LinkedIn] Body length:`, data._debug.bodyLength);
      console.log(`[LinkedIn] Raw data:`, JSON.stringify({
        name: data.name,
        headline: data.headline,
        location: data.location,
        image: data.image,
        about: data.about,
        experienceCount: data.experience.length,
        educationCount: data.education.length,
        skillsCount: data.skills.length,
      }, null, 2));

      if (!data.name || data.name === "Join LinkedIn") {
        result = { error: `Could not scrape '${username}' — hit auth wall or empty page.` };
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
        profileUrl: `https://www.linkedin.com/in/${username}/`,
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
      // @ts-ignore
      console.log(`[LinkedIn] Crawlee failed: ${error.message}`);
      // @ts-ignore
      result = { error: `Scraping failed: ${error.message}` };
    },
  });

  await crawler.run([{ url }]);

  return result ?? { error: "No result — crawler may have timed out." };
}