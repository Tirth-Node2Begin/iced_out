import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "../video-frames/_built";
const URL = process.argv[3] ?? "http://localhost:3000/new-home";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(4000); // let the hero timeline finish

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

await shot("01-hero");

const height = await page.evaluate(() => document.body.scrollHeight);
const tops = await page.evaluate(() =>
  Object.fromEntries(
    ["#workout", "#picks", "#showcase", "#fits"].map((s) => [
      s,
      Math.round(document.querySelector(s).getBoundingClientRect().top + window.scrollY),
    ]),
  ),
);
console.log("page height:", height, JSON.stringify(tops));

const show = tops["#showcase"];
const steps = [
  ["02-editorial", tops["#workout"] + 40],
  ["03-editorial-b", tops["#workout"] + 460],
  ["04-picks", tops["#picks"] + 20],
  ["05-picks-b", tops["#picks"] + 560],
  ["06-showcase-1", show + 60],
  ["07-showcase-2", show + 1100],
  ["08-showcase-3", show + 2200],
  ["09-showcase-4", show + 3400],
  ["10-fits", tops["#fits"] + 20],
  ["11-fits-b", tops["#fits"] + 700],
  ["12-footer", height],
];

for (const [name, y] of steps) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await page.waitForTimeout(1100);
  await shot(name);
}

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
