import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "../video-frames/_built/load";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// warm the cache so image decode doesn't skew the timeline
await page.goto("http://localhost:3000/new-home", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const marks = [300, 600, 900, 1200, 1500, 1800, 2100, 2600, 3400];
await page.goto("http://localhost:3000/new-home", { waitUntil: "commit" });
const t0 = Date.now();

for (const ms of marks) {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/t${String(ms).padStart(4, "0")}.png` });
  const state = await page.evaluate(() => {
    const o = (sel) => {
      const el = document.querySelector(sel);
      return el ? (+getComputedStyle(el).opacity).toFixed(2) : "-";
    };
    const model = document.querySelector(".nh-hero__model");
    return {
      modelTransform: model ? getComputedStyle(model).transform.slice(0, 46) : "-",
      review: o(".nh-hero__aside--left > div"),
      film: o(".nh-hero__aside--right > div"),
      cta: o(".nh-hero__cta"),
      title: o(".nh-hero__title span span"),
    };
  });
  console.log(`${ms}ms`, JSON.stringify(state));
}

await browser.close();
