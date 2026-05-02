// Headless Chromium recording of the TM Radar demo flow.
// Drives the local Vite dev server with ?demo=1 (forced fast simulated cert
// stream) so the radar fills quickly and a critical alert lands within ~10s.
//
// Output: docs/preview.webm (GitHub renders <video> inline).
//
// Run with `node scripts/record-demo.mjs` after `npm run dev` is up.

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const docsDir = path.resolve('docs');
await fs.mkdir(docsDir, { recursive: true });

// Clean any previous artifacts so we can find the freshly written one.
for (const f of await fs.readdir(docsDir).catch(() => [])) {
  if (f.endsWith('.webm')) await fs.rm(path.join(docsDir, f));
}

const VIEWPORT = { width: 1280, height: 800 };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: docsDir, size: VIEWPORT },
  deviceScaleFactor: 2, // crisper output for retina
});
const page = await context.newPage();

page.on('pageerror', (err) => console.error('[page error]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[console]', msg.text());
});

console.log('▶ navigate');
await page.goto('http://localhost:5173/tm-radar/?demo=1', {
  waitUntil: 'networkidle',
});

await page.waitForSelector('input[type="text"]');
await page.waitForTimeout(900); // settle so the badge bar is rendered

console.log('▶ type brand');
await page.fill('input[type="text"]', 'nike');
await page.waitForTimeout(600);

console.log('▶ click Start Analysis');
await page.click('button[type="submit"]');

// Demo-mode emits 3 random benign domains every 220ms (radar fills fast)
// + a brand-suspicious variant every 9–12s. We need at least one suspicious
// to expand into a memo. Wait long enough.
console.log('▶ wait for radar fill + first suspicious alert');
await page.waitForTimeout(11000);

// Expand the first available alert's Details panel
try {
  await page.waitForSelector(
    '[role="article"] button[aria-expanded="false"]',
    { timeout: 4000 },
  );
  console.log('▶ expand first alert');
  await page.click('[role="article"] button[aria-expanded="false"]');
  await page.waitForTimeout(3500); // let the memo render and stream
} catch {
  console.log('  (no alert expandable yet — continuing without expand)');
  await page.waitForTimeout(2000);
}

console.log('▶ stop & finalize');
await context.close();
await browser.close();

const produced = (await fs.readdir(docsDir)).find((f) => f.endsWith('.webm'));
if (!produced) {
  console.error('✗ no .webm produced');
  process.exit(1);
}
const finalPath = path.join(docsDir, 'preview.webm');
await fs.rename(path.join(docsDir, produced), finalPath);
const { size } = await fs.stat(finalPath);
console.log(`✓ saved ${finalPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
