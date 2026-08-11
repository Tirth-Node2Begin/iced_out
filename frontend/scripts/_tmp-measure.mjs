import { chromium } from "playwright";
const browser = await chromium.launch();
const sizes = [[1656,810],[1600,1000],[1440,780],[1280,720],[1920,1080]];
for (const [width,height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://localhost:3000/new-home", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const data = await page.evaluate(() => {
    const r = (sel) => { const el=document.querySelector(sel); if(!el) return null; const b=el.getBoundingClientRect();
      return {w:Math.round(b.width),h:Math.round(b.height),y:Math.round(b.y+window.scrollY)}; };
    return { vh: window.innerHeight, vw: window.innerWidth,
      doc: document.documentElement.scrollHeight,
      hero: r(".nh-hero"), stage: r(".nh-hero__stage"), copy: r(".nh-hero__copy"),
      title: r(".nh-hero__title"), titleFs: getComputedStyle(document.querySelector(".nh-hero__title")).fontSize,
      model: r(".nh-hero__modelWrap"), sections: ["#workout","#picks","#showcase","#fits"].map(s=>[s, r(s)?.y, r(s)?.h]) };
  });
  console.log(width+"x"+height, JSON.stringify(data));
  await page.close();
}
await browser.close();
