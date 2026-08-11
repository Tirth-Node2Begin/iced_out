import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto("http://localhost:3000/new-home", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const ids = await page.evaluate(() =>
  [...document.querySelectorAll("[id]")].map((e) => e.id),
);
const sections = await page.evaluate(() =>
  [...document.querySelectorAll("section")].map(
    (s) => `${s.id || "(no id)"} h=${Math.round(s.getBoundingClientRect().height)}`,
  ),
);
console.log("ids:", JSON.stringify(ids));
console.log("sections:", JSON.stringify(sections, null, 1));
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
