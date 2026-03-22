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
  const ddgUrl = `https://html.duckduckgo.com/html/?q=linkedin.com%2Fin%2F${username}`;

  let result: LinkedInProfile | { error: string } | null = null;

  console.log(`[LinkedIn] DDG search for: ${username}`);

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1,
    requestHandlerTimeoutSecs: 90,
    launchContext: {
      launchOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1440,900",
        ],
      },
    },

    preNavigationHooks: [
      async ({ page }) => {
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => undefined });
          Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
          Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
          (window as any).chrome = { runtime: {} };
        });
        await page.setExtraHTTPHeaders({
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        });
        await page.setViewportSize({ width: 1440, height: 900 });
      },
    ],

    async requestHandler({ page }) {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500 + Math.random() * 1000);

      console.log(`[LinkedIn] On DDG: ${page.url()}`);
      await page.screenshot({ path: `ddg-debug-${username}.png` });

      // Extract LinkedIn URL from DDG redirect links
      const linkedinHref = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        for (const a of links) {
          const href = (a as HTMLAnchorElement).href ?? "";
          if (href.includes("uddg=")) {
            try {
              const uddg = new URL(href).searchParams.get("uddg");
              if (uddg) {
                const decoded = decodeURIComponent(uddg);
                if (decoded.toLowerCase().includes("linkedin.com/in/")) return decoded;
              }
            } catch {}
          }
        }
        return null;
      });

      console.log(`[LinkedIn] Extracted URL: ${linkedinHref}`);

      if (!linkedinHref) {
        result = { error: `Could not find LinkedIn link for '${username}'.` };
        return;
      }

      const context = page.context();

      // Listen for new tab BEFORE opening
      const newPagePromise = context.waitForEvent("page", { timeout: 15000 });

      // Open LinkedIn in new tab via window.open
      await page.evaluate((url) => window.open(url, "_blank"), linkedinHref);

      const linkedinPage = await newPagePromise;
      console.log(`[LinkedIn] New tab opened: ${linkedinPage.url()}`);

      // ← Close the DDG tab immediately
      await page.close();
      console.log(`[LinkedIn] DDG tab closed`);

      // Now work on LinkedIn tab
      await linkedinPage.waitForLoadState("domcontentloaded");
      await linkedinPage.waitForTimeout(3000 + Math.random() * 2000);

      // Human-like scroll
      await linkedinPage.mouse.move(700, 400);
      await linkedinPage.waitForTimeout(300);
      await linkedinPage.mouse.wheel(0, 200);
      await linkedinPage.waitForTimeout(500);

      const finalUrl = linkedinPage.url();
      console.log(`[LinkedIn] Final URL: ${finalUrl}`);
      await linkedinPage.screenshot({ path: `linkedin-debug-${username}.png` });
      console.log(`[LinkedIn] LinkedIn screenshot saved`);

      if (
        finalUrl.includes("/login") ||
        finalUrl.includes("/authwall") ||
        finalUrl.includes("/checkpoint")
      ) {
        console.log(`[LinkedIn] Hit auth wall`);
        result = { error: `Profile '${username}' — LinkedIn blocked the request.` };
        return;
      }

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

        const allH1s = Array.from(document.querySelectorAll("h1")).map(el => el.textContent?.trim());
        const first500 = document.body.innerText.slice(0, 500);

        const name = getText(["h1.top-card-layout__title", "h1.text-heading-xlarge", ".top-card-layout__title", "h1"]);
        const headline = getText([".top-card-layout__headline", ".top-card__subline-item", ".text-body-medium.break-words"]);
        const location = getText([".top-card__subline-item:nth-child(2)", ".text-body-small.inline.t-black--light.break-words"]);
        const image = getImg([".top-card__profile-image", ".pv-top-card-profile-picture__image", "img[alt*='photo']"]);
        const about = getText([".core-section-container__content .full-width", ".top-card-layout__summary"]);

        const expEls = Array.from(document.querySelectorAll("#experience ~ .pvs-list__outer-container li, .experience-section li"));
        const experience = expEls.slice(0, 10).map((el) => ({
          title: el.querySelector(".mr1.t-bold span, .t-14.t-bold span")?.textContent?.trim() ?? null,
          company: el.querySelector(".t-14.t-normal span, .pv-entity__secondary-title")?.textContent?.trim() ?? null,
          duration: el.querySelector(".pvs-entity__caption-wrapper")?.textContent?.trim() ?? null,
        }));

        const eduEls = Array.from(document.querySelectorAll("#education ~ .pvs-list__outer-container li, .education-section li"));
        const education = eduEls.slice(0, 5).map((el) => ({
          school: el.querySelector(".mr1.t-bold span, .pv-entity__school-name")?.textContent?.trim() ?? null,
          degree: el.querySelector(".t-14.t-normal span")?.textContent?.trim() ?? null,
          years: el.querySelector(".pvs-entity__caption-wrapper")?.textContent?.trim() ?? null,
        }));

        const skillEls = Array.from(document.querySelectorAll("#skills ~ .pvs-list__outer-container li .mr1.t-bold span"));
        const skills = skillEls.map((el) => el.textContent?.trim()).filter(Boolean) as string[];

        return { name, headline, location, image, about, experience, education, skills, _debug: { allH1s, first500, bodyLength: document.body.innerHTML.length } };
      });

      console.log(`[LinkedIn] H1s:`, data._debug.allH1s);
      console.log(`[LinkedIn] First 500:`, data._debug.first500);
      console.log(`[LinkedIn] name: "${data.name}", headline: "${data.headline}"`);

      if (!data.name || data.name === "Join LinkedIn") {
        result = { error: `Could not scrape '${username}' — profile may be private.` };
        return;
      }

      const experience = data.experience.filter((e: any) => e.title || e.company).map((e: any) => ({
        title: e.title ?? "Unknown Role",
        company: e.company ?? "Unknown",
        duration: e.duration ?? null,
        description: null,
      }));

      const education = data.education.filter((e: any) => e.school).map((e: any) => ({
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
        currentRole: experience[0] ? `${experience[0].title} at ${experience[0].company}` : data.headline ?? null,
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

  await crawler.run([{ url: ddgUrl }]);

  return result ?? { error: "No result — crawler timed out." };
}