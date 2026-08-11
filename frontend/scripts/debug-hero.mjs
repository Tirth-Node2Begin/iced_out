import { chromium } from "playwright";

const browser = await chromium.launch();

for (const reduced of [false, true]) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto("http://localhost:3000/new-home", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  const info = await page.evaluate(() => {
    const copy = document.querySelector(".nh-hero__copy");
    const title = document.querySelector(".nh-hero__title");
    const chars = [...document.querySelectorAll(".nh-hero__title span span")];
    const cta = document.querySelector(".nh-hero__cta");
    const g = (el) => (el ? getComputedStyle(el) : null);
    return {
      copyOpacity: g(copy)?.opacity,
      titleOpacity: g(title)?.opacity,
      titleRect: title ? JSON.stringify(title.getBoundingClientRect().toJSON()) : null,
      charCount: chars.length,
      firstCharOpacity: chars.length ? getComputedStyle(chars[0]).opacity : null,
      lastCharOpacity: chars.length
        ? getComputedStyle(chars[chars.length - 1]).opacity
        : null,
      ctaOpacity: g(cta)?.opacity,
      fontFamily: g(title)?.fontFamily,
    };
  });
  console.log(`reducedMotion=${reduced}`, JSON.stringify(info, null, 1));
  await page.close();
}

await browser.close();
