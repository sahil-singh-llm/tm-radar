// Headed Playwright driver for the TM Radar demo flow — companion to
// record-demo.mjs. This script does NOT record; it only drives the app at a
// human-readable pace inside a visible Chromium window so a screen-recorder
// (e.g. Recordly) can capture it with cursor effects and zoom regions.
//
// Pre-flight:
//   1. `npm run dev` is up at http://localhost:5173
//   2. Recordly is configured to capture the Chromium window that this script
//      opens (window-capture, not full screen).
//
// Run:
//   node scripts/record-demo-headed.mjs
//
// Timing matches the zoom cues documented alongside this script. Adjust the
// PAUSE constants if you want the recording faster/slower.

import { chromium } from 'playwright';

const VIEWPORT = { width: 1280, height: 800 };

// Tunable pacing — kept in one block for easy tweaking against zoom cues.
const PRE_RECORD_GRACE_MS = 3500; // time to switch to Recordly + hit Start
const POST_NAV_SETTLE_MS = 1200;  // landing screen on display
const TYPE_DELAY_MS = 110;         // per-char typing delay (visible)
const POST_TYPE_PAUSE_MS = 700;
const RADAR_FILL_MS = 9000;        // watch radar fill before alert
const POST_EXPAND_HOLD_MS = 6000;  // hold on streaming memo for the payoff
const FINAL_PULLBACK_MS = 2500;    // pull-back hold at the end

const browser = await chromium.launch({
  headless: false,
  args: [
    `--window-size=${VIEWPORT.width},${VIEWPORT.height + 120}`, // +chrome UI
    '--window-position=120,80',
  ],
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
});
const page = await context.newPage();

page.on('pageerror', (err) => console.error('[page error]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[console]', msg.text());
});

const stamp = () => {
  const s = (Date.now() - t0) / 1000;
  return `[${s.toFixed(1).padStart(5, ' ')}s]`;
};

const t0 = Date.now();
console.log('navigating in headless-but-visible mode…');
await page.goto('http://localhost:5173/tm-radar/?demo=1', {
  waitUntil: 'networkidle',
});
await page.waitForSelector('input[type="text"]');

console.log(stamp(), 'window ready — switch to Recordly and hit Start now.');
console.log(`waiting ${PRE_RECORD_GRACE_MS}ms before driving the demo…`);
await page.waitForTimeout(PRE_RECORD_GRACE_MS);

// ---- 0:00 hook: landing screen visible ----
console.log(stamp(), 'hook: landing screen on display');
await page.waitForTimeout(POST_NAV_SETTLE_MS);

// ---- type brand (visible, character-by-character) ----
console.log(stamp(), 'type brand "nike"');
await page.click('input[type="text"]');
await page.type('input[type="text"]', 'nike', { delay: TYPE_DELAY_MS });
await page.waitForTimeout(POST_TYPE_PAUSE_MS);

// ---- click Start Analysis ----
console.log(stamp(), 'click Start Analysis');
await page.click('button[type="submit"]');

// ---- radar fills with benign domains; suspicious arrives on its own timer ----
console.log(stamp(), `radar fill window (${RADAR_FILL_MS}ms)`);
await page.waitForTimeout(RADAR_FILL_MS);

// ---- expand first available alert into its memo ----
try {
  await page.waitForSelector(
    '[role="article"] button[aria-expanded="false"]',
    { timeout: 6000 },
  );
  console.log(stamp(), 'expand first alert');
  await page.click('[role="article"] button[aria-expanded="false"]');
  await page.waitForTimeout(POST_EXPAND_HOLD_MS);
} catch {
  console.warn(stamp(), 'no expandable alert appeared — continuing');
  await page.waitForTimeout(2500);
}

// ---- pull-back hold (radar + memo both visible) for the payoff frame ----
console.log(stamp(), 'pull-back hold');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await page.waitForTimeout(FINAL_PULLBACK_MS);

console.log(stamp(), 'demo complete — stop Recordly now.');
console.log('window stays open for 4s so you can hit Stop without cutting off.');
await page.waitForTimeout(4000);

await context.close();
await browser.close();
