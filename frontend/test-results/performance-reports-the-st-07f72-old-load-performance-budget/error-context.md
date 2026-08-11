# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance.spec.ts >> reports the storefront cold-load performance budget
- Location: e2e\performance.spec.ts:3:5

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 2500
Received:   2656
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "Skip to content" [ref=e3] [cursor=pointer]:
      - /url: "#main-content"
    - banner [ref=e5]:
      - generic [ref=e6]:
        - link "Iced_out — home" [ref=e8] [cursor=pointer]:
          - /url: /
          - generic [ref=e12]:
            - generic [ref=e13]: I
            - generic [ref=e14]: c
            - generic [ref=e15]: e
            - generic [ref=e16]: d
            - generic [ref=e17]: O
            - generic [ref=e18]: u
            - generic [ref=e19]: t
        - navigation "Primary navigation" [ref=e20]:
          - link "Men" [ref=e21] [cursor=pointer]:
            - /url: /new-man
          - link "Women" [ref=e24] [cursor=pointer]:
            - /url: /new-woman
          - link "New drop" [ref=e27] [cursor=pointer]:
            - /url: /new-drop
          - link "Sale" [ref=e30] [cursor=pointer]:
            - /url: /sale
          - link "About" [ref=e31] [cursor=pointer]:
            - /url: /about
          - link "Contact" [ref=e32] [cursor=pointer]:
            - /url: /contact
        - generic [ref=e33]:
          - generic [ref=e34]:
            - link "Bag" [ref=e35] [cursor=pointer]:
              - /url: /cart
            - link "Profile" [ref=e39] [cursor=pointer]:
              - /url: /auth/login?returnTo=%2Faccount
          - link "Login" [ref=e43] [cursor=pointer]:
            - /url: /auth/login?returnTo=%2F
    - main [ref=e44]:
      - generic [ref=e45]:
        - heading "I c e d O u t" [level=1] [ref=e47]:
          - generic [ref=e49]:
            - generic [ref=e50]: I
            - generic [ref=e51]: c
            - generic [ref=e52]: e
            - generic [ref=e53]: d
          - generic [ref=e55]:
            - generic [ref=e56]: O
            - generic [ref=e57]: u
            - generic [ref=e58]: t
        - generic [ref=e59]:
          - img "Outerwear set, gold-lit concrete" [ref=e61]
          - img "Layered flatlay on steel" [ref=e63]
          - img "Wet-floor underpass campaign frame" [ref=e65]
          - img "Campaign pair against a lit panel" [ref=e67]
          - img "Cotton overshirt, studio still" [ref=e69]
          - img "Concrete corridor, full-length" [ref=e71]
      - generic [ref=e72]:
        - generic [ref=e73]: "2016"
        - paragraph [ref=e75]:
          - generic [ref=e76]: We
          - generic [ref=e77]: create
          - generic [ref=e78]: timeless
          - generic [ref=e79]: architectural
          - generic [ref=e80]: and
          - generic [ref=e81]: interior
          - generic [ref=e82]: spaces
          - generic [ref=e83]: focused
          - generic [ref=e84]: "on"
          - generic [ref=e85]: clarity,
          - generic [ref=e86]: functionality,
          - generic [ref=e87]: and
          - generic [ref=e88]: modern
          - generic [ref=e89]: living
        - generic [ref=e90]: "2025"
      - generic [ref=e92]:
        - generic [ref=e93]:
          - paragraph [ref=e94]: Philosophy
          - paragraph [ref=e96]:
            - generic [ref=e97]: Every
            - generic [ref=e98]: project
            - generic [ref=e99]: is
            - generic [ref=e100]: shaped
            - generic [ref=e101]: through
            - generic [ref=e102]: proportion,
            - generic [ref=e103]: light,
            - generic [ref=e104]: texture,
            - generic [ref=e105]: and
            - generic [ref=e106]: spatial
            - generic [ref=e107]: balance.
            - generic [ref=e108]: We
            - generic [ref=e109]: believe
            - generic [ref=e110]: great
            - generic [ref=e111]: design
            - generic [ref=e112]: should
            - generic [ref=e113]: feel
            - generic [ref=e114]: natural
            - generic [ref=e115]: over
            - generic [ref=e116]: time,
            - generic [ref=e117]: creating
            - generic [ref=e118]: environments
            - generic [ref=e119]: that
            - generic [ref=e120]: are
            - generic [ref=e121]: both
            - generic [ref=e122]: functional
            - generic [ref=e123]: and
            - generic [ref=e124]: emotionally
            - generic [ref=e125]: connected
            - generic [ref=e126]: to
            - generic [ref=e127]: everyday
            - generic [ref=e128]: life
        - img "Two figures in a concrete underpass" [ref=e132]
      - generic [ref=e134]:
        - generic [ref=e135]: Meet the founders
        - generic [ref=e136]:
          - img "Elena Carter" [ref=e137]
          - img "Marcus Lindberg" [ref=e138]
          - img "Sofia Bennett" [ref=e139]
          - img "Daniel Foster" [ref=e140]
        - generic [ref=e142]:
          - generic [ref=e143]: "01"
          - heading "Elena Carter" [level=3]:
            - generic:
              - generic: Elena
              - generic: Carter
          - generic [ref=e144]: Founder & Creative Director
          - paragraph [ref=e145]: Leads the studio's creative vision with a focus on timeless interiors, spatial harmony, and material storytelling.
      - generic [ref=e153]:
        - generic [ref=e154]:
          - generic [ref=e155]: Studio Highlights
          - heading "Designed for creativity and collaboration" [level=2] [ref=e157]:
            - generic [ref=e158]: Designed
            - generic [ref=e159]: for
            - generic [ref=e160]: creativity
            - generic [ref=e161]: and
            - generic [ref=e162]: collaboration
        - generic [ref=e163]:
          - generic [ref=e165]:
            - generic [ref=e166]: "01"
            - img "Material Library" [ref=e169]
            - heading "Material Library" [level=3]: MaterialLibrary
          - generic [ref=e173]:
            - generic [ref=e174]:
              - generic [ref=e175]: "01"
              - generic [ref=e176]: Material Library
            - paragraph [ref=e177]: Our studio reflects the same principles we bring into every project — calm atmosphere, refined materials, natural light, and intentional design decisions that support both creativity and focus.
          - generic [ref=e179]:
            - generic [ref=e180]: "02"
            - img "Collaborative Workspace" [ref=e183]
            - heading "Collaborative Workspace" [level=3]: CollaborativeWorkspace
          - generic [ref=e185]:
            - generic [ref=e186]: "03"
            - img "Design Archive" [ref=e189]
            - heading "Design Archive" [level=3]: DesignArchive
      - generic [ref=e191]:
        - generic [ref=e192]:
          - heading "What our clients say" [level=2] [ref=e194]:
            - generic [ref=e195]: What
            - generic [ref=e196]: our
            - generic [ref=e197]: clients
            - generic [ref=e198]: say
          - generic [ref=e199]:
            - button "Previous testimonial" [ref=e200] [cursor=pointer]
            - button "Next testimonial" [ref=e203] [cursor=pointer]
        - generic [ref=e207]:
          - img "Emma Larson" [ref=e210]
          - generic [ref=e211]:
            - generic [ref=e212]: "01"
            - paragraph [ref=e213]: “The team created a home that feels calm, timeless, and deeply personal. Every detail was thoughtfully considered from start to finish.”
            - generic [ref=e214]:
              - generic [ref=e215]: Emma Larson
              - generic [ref=e216]: Private residence client
    - contentinfo [ref=e217]:
      - generic [ref=e218]:
        - generic [ref=e219]:
          - generic [ref=e220]:
            - paragraph [ref=e221]: Gear up · every season
            - paragraph [ref=e222]: Built for the cold starts and the long finishes. Limited runs, restocked when the season turns.
          - navigation "Footer" [ref=e223]:
            - generic [ref=e224]:
              - heading "Shop" [level=4] [ref=e225]
              - link "Men" [ref=e226] [cursor=pointer]:
                - /url: /new-man
              - link "Women" [ref=e227] [cursor=pointer]:
                - /url: /new-woman
              - link "Accessories" [ref=e228] [cursor=pointer]:
                - /url: /collections
              - link "Seasonal" [ref=e229] [cursor=pointer]:
                - /url: /sale
            - generic [ref=e230]:
              - heading "Support" [level=4] [ref=e231]
              - link "Shipping" [ref=e232] [cursor=pointer]:
                - /url: /pages/shipping-policy
              - link "Returns" [ref=e233] [cursor=pointer]:
                - /url: /pages/return-policy
              - link "Size guide" [ref=e234] [cursor=pointer]:
                - /url: /contact
              - link "Contact" [ref=e235] [cursor=pointer]:
                - /url: /contact
            - generic [ref=e236]:
              - heading "Studio" [level=4] [ref=e237]
              - link "About" [ref=e238] [cursor=pointer]:
                - /url: /about
              - link "Journal" [ref=e239] [cursor=pointer]:
                - /url: /contact
              - link "Stockists" [ref=e240] [cursor=pointer]:
                - /url: /contact
              - link "Careers" [ref=e241] [cursor=pointer]:
                - /url: /contact
        - paragraph [ref=e242]: Iced_out
        - generic [ref=e243]:
          - generic [ref=e244]: © 2026 Iced_out
          - generic [ref=e245]: Every season · every workout
    - generic: I
    - generic: c
    - generic: e
    - generic: d
    - generic: O
    - generic: u
    - generic: t
  - alert [ref=e246]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("reports the storefront cold-load performance budget", async ({ context, page }) => {
  4  |   const path = process.env.PERF_PATH ?? "/";
  5  |   const session = await context.newCDPSession(page);
  6  |   await session.send("Network.enable");
  7  |   await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  8  |   await session.send("Network.emulateNetworkConditions", {
  9  |     offline: false,
  10 |     latency: 100,
  11 |     downloadThroughput: 200 * 1024,
  12 |     uploadThroughput: 100 * 1024,
  13 |   });
  14 |   await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  15 | 
  16 |   await page.addInitScript(() => {
  17 |     (window as Window & { __lcp?: number }).__lcp = 0;
  18 |     new PerformanceObserver((list) => {
  19 |       const entries = list.getEntries();
  20 |       (window as Window & { __lcp?: number }).__lcp = entries.at(-1)?.startTime ?? 0;
  21 |     }).observe({ type: "largest-contentful-paint", buffered: true });
  22 |   });
  23 | 
  24 |   await page.goto(path, { waitUntil: "networkidle" });
  25 |   await page.waitForTimeout(500);
  26 | 
  27 |   const metrics = await page.evaluate(() => {
  28 |     const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  29 |     const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  30 |     const totalFor = (type: string) =>
  31 |       resources
  32 |         .filter((entry) => entry.initiatorType === type)
  33 |         .reduce((total, entry) => total + entry.encodedBodySize, 0);
  34 |     return {
  35 |       domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
  36 |       load: Math.round(navigation.loadEventEnd),
  37 |       firstContentfulPaint: Math.round(
  38 |         performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
  39 |       ),
  40 |       largestContentfulPaint: Math.round(
  41 |         (window as Window & { __lcp?: number }).__lcp ?? 0,
  42 |       ),
  43 |       requests: resources.length,
  44 |       transferKb: Math.round(resources.reduce((total, entry) => total + entry.encodedBodySize, 0) / 1024),
  45 |       scriptKb: Math.round(totalFor("script") / 1024),
  46 |       cssKb: Math.round(totalFor("link") / 1024),
  47 |       imageKb: Math.round(totalFor("img") / 1024),
  48 |     };
  49 |   });
  50 | 
  51 |   console.log(`PERF_METRICS ${path} ${JSON.stringify(metrics)}`);
> 52 |   expect(metrics.firstContentfulPaint).toBeLessThan(2_500);
     |                                        ^ Error: expect(received).toBeLessThan(expected)
  53 |   expect(metrics.largestContentfulPaint).toBeLessThan(3_000);
  54 |   expect(metrics.transferKb).toBeLessThan(650);
  55 |   expect(metrics.scriptKb).toBeLessThan(250);
  56 | });
  57 | 
```