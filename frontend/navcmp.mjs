import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const browser = await chromium.launch({ channel: "chrome", headless: true });

for (const [name, url] of [["home", "http://localhost:3000/"], ["men", "http://localhost:3000/men"]]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1200);
  await page.locator(".nh-nav__inner").hover().catch(() => {});
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => {
    const nav = document.querySelector(".nh-nav");
    const plate = document.querySelector(".nh-nav__plate");
    const scrim = document.querySelector(".nh-nav__scrim");
    const scope = document.querySelector(".nh-nav-scope");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      elevated: nav?.getAttribute("data-elevated"),
      plateAttr: nav?.getAttribute("data-plate"),
      plateBg: cs(plate)?.backgroundColor,
      plateOpacity: cs(plate)?.opacity,
      scrimOpacity: cs(scrim)?.opacity,
      tokenPlate: cs(scope)?.getPropertyValue("--io-nav-plate").trim(),
      tokenScrim: cs(scope)?.getPropertyValue("--io-nav-scrim").trim(),
    };
  });
  console.log(name.padEnd(5), JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/nav-${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 110 } });
  await page.close();
}
await browser.close();
