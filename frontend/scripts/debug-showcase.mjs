import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://localhost:3000/new-home", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const show = await page.evaluate(
  () =>
    document.querySelector("#showcase").getBoundingClientRect().top +
    window.scrollY,
);
const secH = await page.evaluate(
  () => document.querySelector("#showcase").getBoundingClientRect().height,
);
console.log("showcase top:", Math.round(show), "height:", Math.round(secH));

for (const dy of [60, 600, 1100, 2200, 3400, 4200]) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), show + dy);
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const sticky = document.querySelector(".nh-showcase__sticky");
    const stack = document.querySelector(".nh-showcase__stack");
    const slides = [...document.querySelectorAll(".nh-card3d--stacked")];
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return `${Math.round(b.top)},${Math.round(b.height)}`;
    };
    return {
      stickyRect: r(sticky),
      stackRect: r(stack),
      stackOpacity: getComputedStyle(stack).opacity,
      slideOpacities: slides.map((s) => (+getComputedStyle(s).opacity).toFixed(2)),
    };
  });
  console.log(`+${dy}`, JSON.stringify(info));
}

await browser.close();
