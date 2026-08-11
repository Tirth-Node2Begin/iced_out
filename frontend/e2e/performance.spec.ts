import { expect, test } from "@playwright/test";

test("reports the storefront cold-load performance budget", async ({ context, page }) => {
  const path = process.env.PERF_PATH ?? "/";
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 100,
    downloadThroughput: 200 * 1024,
    uploadThroughput: 100 * 1024,
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.addInitScript(() => {
    (window as Window & { __lcp?: number }).__lcp = 0;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      (window as Window & { __lcp?: number }).__lcp = entries.at(-1)?.startTime ?? 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const totalFor = (type: string) =>
      resources
        .filter((entry) => entry.initiatorType === type)
        .reduce((total, entry) => total + entry.encodedBodySize, 0);
    return {
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
      load: Math.round(navigation.loadEventEnd),
      firstContentfulPaint: Math.round(
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
      ),
      largestContentfulPaint: Math.round(
        (window as Window & { __lcp?: number }).__lcp ?? 0,
      ),
      requests: resources.length,
      transferKb: Math.round(resources.reduce((total, entry) => total + entry.encodedBodySize, 0) / 1024),
      scriptKb: Math.round(totalFor("script") / 1024),
      cssKb: Math.round(totalFor("link") / 1024),
      imageKb: Math.round(totalFor("img") / 1024),
    };
  });

  console.log(`PERF_METRICS ${path} ${JSON.stringify(metrics)}`);
  expect(metrics.firstContentfulPaint).toBeLessThan(2_500);
  expect(metrics.largestContentfulPaint).toBeLessThan(3_000);
  expect(metrics.transferKb).toBeLessThan(650);
  expect(metrics.scriptKb).toBeLessThan(250);
});
