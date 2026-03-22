import { PlaywrightCrawler } from "crawlee";
import type { LinkedInProfile } from "../types";

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
  const linkedinUrl = `https://www.linkedin.com/in/${username}/`;
  const bingSearchUrl = `https://www.bing.com/search?q=linkedin.com/in/${username}`;
  let result: LinkedInProfile | { error: string } | null = null;

  console.log(`[LinkedIn] Starting Bing search for: ${username}`);

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1, // only need bing page — we handle LinkedIn manually
    requestHandlerTimeoutSecs: 90,
    launchContext: {
      launchOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      },
    },

    async requestHandler({ page, request }) {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      console.log(`[LinkedIn] On Bing: ${page.url()}`);
      await page.screenshot({ path: `bing-debug-${username}.png` });

      // Get the browser context to listen for new tabs
      const context = page.context();

      // Listen for new page BEFORE clicking
      const newPagePromise = context.waitForEvent("page", { timeout: 15000 });

      // Click the first result heading
      const firstHeading = page.locator(".b_algo h2 a").first();
      const headingText = await firstHeading.textContent();
      console.log(`[LinkedIn] Clicking: "${headingText}"`);

      await firstHeading.click();

      // Wait for the new tab to open
      let linkedinPage;
      try {
        linkedinPage = await newPagePromise;
        console.log(`[LinkedIn] New tab opened: ${linkedinPage.url()}`);
      } catch {
        // No new tab — maybe it navigated in same tab
        console.log(`[LinkedIn] No new tab, checking same page...`);
        linkedinPage = page;
      }

      await linkedinPage.waitForLoadState("domcontentloaded");
      await linkedinPage.waitForTimeout(3000);

      const finalUrl = linkedinPage.url();
      console.log(`[LinkedIn] Final URL: ${finalUrl}`);
      await linkedinPage.screenshot({ path: `linkedin-debug-${username}.png` });
      console.log(`[LinkedIn] LinkedIn screenshot saved`);

      // Check for auth wall
      if (
        finalUrl.includes("/login") ||
        finalUrl.includes("/authwall") ||
        finalUrl.includes("/checkpoint")
      ) {
        result = { error: `Profile '${username}' requires login.` };
        return;
      }

      // Scrape the page
      const data = await linkedinPage.evaluate(() => {
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
            if (el?.src && !el.src.includes("data:")) return el.src;
          }
          return null;
        };

        const allH1s = Array.from(document.querySelectorAll("h1"))
          .map(el => el.textContent?.trim());

        const allClasses = Array.from(document.querySelectorAll("[class]"))
          .slice(0, 30)
          .map(el => el.className.toString().slice(0, 60));

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
        ]);

        const image = getImg([
          ".top-card__profile-image",
          ".pv-top-card-profile-picture__image",
          "img[alt*='photo']",
          "img[alt*='profile']",
        ]);

        const about = getText([
          ".core-section-container__content .full-width",
          ".top-card-layout__summary",
          ".pv-about-section p",
        ]);

        const expEls = Array.from(document.querySelectorAll(
          "#experience ~ .pvs-list__outer-container li, .experience-section li"
        ));
        const experience = expEls.slice(0, 10).map((el) => ({
          title: el.querySelector(".mr1.t-bold span, .t-14.t-bold span")?.textContent?.trim() ?? null,
          company: el.querySelector(".t-14.t-normal span, .pv-entity__secondary-title")?.textContent?.trim() ?? null,
          duration: el.querySelector(".pvs-entity__caption-wrapper")?.textContent?.trim() ?? null,
        }));

        const eduEls = Array.from(document.querySelectorAll(
          "#education ~ .pvs-list__outer-container li, .education-section li"
        ));
        const education = eduEls.slice(0, 5).map((el) => ({
          school: el.querySelector(".mr1.t-bold span, .pv-entity__school-name")?.textContent?.trim() ?? null,
          degree: el.querySelector(".t-14.t-normal span")?.textContent?.trim() ?? null,
          years: el.querySelector(".pvs-entity__caption-wrapper")?.textContent?.trim() ?? null,
        }));

        const skillEls = Array.from(document.querySelectorAll(
          "#skills ~ .pvs-list__outer-container li .mr1.t-bold span"
        ));
        const skills = skillEls
          .map((el) => el.textContent?.trim())
          .filter(Boolean) as string[];

        return {
          name, headline, location, image, about,
          experience, education, skills,
          _debug: { allH1s, allClasses, bodyLength: document.body.innerHTML.length },
        };
      });

      console.log(`[LinkedIn] H1s:`, data._debug.allH1s);
      console.log(`[LinkedIn] Body length:`, data._debug.bodyLength);
      console.log(`[LinkedIn] Top classes:`, data._debug.allClasses.slice(0, 10));
      console.log(`[LinkedIn] name: "${data.name}", headline: "${data.headline}"`);
      console.log(`[LinkedIn] exp: ${data.experience.length}, edu: ${data.education.length}, skills: ${data.skills.length}`);

      if (!data.name || data.name === "Join LinkedIn") {
        result = { error: `Could not scrape '${username}' — profile may be private.` };
        return;
      }

      const experience = data.experience
        .filter((e: any) => e.title || e.company)
        .map((e: any) => ({
          title: e.title ?? "Unknown Role",
          company: e.company ?? "Unknown",
          duration: e.duration ?? null,
          description: null,
        }));

      const education = data.education
        .filter((e: any) => e.school)
        .map((e: any) => ({
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
        profileUrl: linkedinUrl,
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
      console.log(`[LinkedIn] Failed: ${error.message}`);
      // @ts-ignore
      result = { error: `Scraping failed: ${error.message}` };
    },
  });

  await crawler.run([{ url: bingSearchUrl, label: "BING" }]);

  return result ?? { error: "No result — crawler timed out." };
}