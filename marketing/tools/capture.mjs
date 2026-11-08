// Captures every screen/state used by the promo video, Instagram posts and README screenshots.
// Usage: BASE_URL=http://localhost:3100 node marketing/tools/capture.mjs <outDir>
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { seed, mockWeather, BASE } from './seed.mjs';

// Playwright is preinstalled globally in the capture environment (not an app dependency).
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.argv[2] || 'marketing/raw';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  await mockWeather(ctx);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const go = async (path) => { await p.goto(BASE + path); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(700); };
  const shot = async (name, opts = {}) => p.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  const setTheme = (t) => p.evaluate((x) => localStorage.setItem('theme', x), t);

  // Onboarding states (before seeding).
  for (const t of ['light', 'dark']) {
    await p.goto(BASE + '/onboarding'); await setTheme(t); await go('/onboarding');
    await shot(`${t}-m-welcome`);
  }
  await setTheme('light'); await go('/onboarding');
  await p.getByRole('button', { name: /Find my style/ }).click();
  await p.getByRole('button', { name: 'Womenswear' }).click();
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: /Skip for now/ }).click();
  await p.getByRole('button', { name: "I'd wear it" }).click(); await p.waitForTimeout(400);
  await shot('light-m-swipe');
  await ctx.clearCookies();
  await p.evaluate(() => new Promise((r) => { const d = indexedDB.deleteDatabase('bgadai'); d.onsuccess = d.onerror = d.onblocked = () => r(); }));

  await seed(p);

  for (const t of ['light', 'dark']) {
    await setTheme(t);
    await p.setViewportSize({ width: 390, height: 844 });
    for (const [name, path] of [['today', '/'], ['closet', '/closet'], ['create', '/create'], ['plan', '/plan'], ['me', '/me']]) {
      await go(path);
      if (name === 'create') await p.getByRole('button', { name: /Complete it for me/ }).click();
      await p.waitForTimeout(500);
      await shot(`${t}-m-${name}`);
      // Full-page version for scrolling video scenes: load lazy images, hide the fixed nav
      // (the video overlays the real nav bar from the viewport shot instead).
      await p.evaluate(async () => {
        // Off-screen rows skip rendering (content-visibility) — force them to paint for the capture.
        const st = document.createElement("style");
        st.textContent = ".cv-auto{content-visibility:visible!important}";
        document.head.appendChild(st);
        document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager"));
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
        document.querySelectorAll("nav.fixed").forEach((n) => (n.style.display = "none"));
      });
      // Grow the viewport to the whole page so every image is genuinely on screen when captured
      // (Chromium's fullPage mode can leave off-screen image layers unpainted).
      const fullH = await p.evaluate(() => document.documentElement.scrollHeight);
      await p.setViewportSize({ width: 390, height: fullH });
      await p.waitForTimeout(900);
      await shot(`${t}-m-${name}-full`);
      await p.setViewportSize({ width: 390, height: 844 });
      await p.evaluate(() => document.querySelectorAll("nav.fixed").forEach((n) => (n.style.display = "")));
    }
    // Trip sheet
    await go('/plan');
    await p.getByText('Lisbon').first().click().catch(() => {});
    await p.waitForTimeout(600);
    await shot(`${t}-m-trip`);
    // Buy check + smart buys
    await go('/inspo');
    await p.getByRole('button', { name: 'Before you buy' }).click();
    await p.getByRole('button', { name: 'Shoes', exact: true }).click();
    await p.getByRole('button', { name: 'Boots', exact: true }).click();
    await p.getByRole('button', { name: 'black', exact: true }).click();
    await p.getByRole('button', { name: 'Check by type' }).click();
    await p.locator('.pop-in').first().scrollIntoViewIfNeeded();
    await p.evaluate(() => window.scrollBy(0, -140));
    await p.waitForTimeout(400);
    await shot(`${t}-m-buycheck`);
    await p.getByRole('button', { name: 'Find my best buys' }).click();
    await p.getByText(/\+\d+ outfits/).first().waitFor({ timeout: 20000 });
    await p.getByText('Smart buys').scrollIntoViewIfNeeded();
    await p.evaluate(() => window.scrollBy(0, 140));
    await p.waitForTimeout(400);
    await shot(`${t}-m-smartbuys`);
    // Wrapped
    await go('/me');
    await p.getByText(/Style Wrapped/).scrollIntoViewIfNeeded();
    await p.evaluate(() => window.scrollBy(0, -40));
    await p.waitForTimeout(300);
    await shot(`${t}-m-wrapped`);
    // Desktop
    await p.setViewportSize({ width: 1440, height: 900 });
    for (const [name, path] of [['today', '/'], ['closet', '/closet'], ['plan', '/plan'], ['create', '/create'], ['me', '/me']]) {
      await go(path);
      if (name === 'create') await p.getByRole('button', { name: /Complete it for me/ }).click();
      await p.waitForTimeout(400);
      await shot(`${t}-d-${name}`);
    }
  }
  // Share card image
  await setTheme('light'); await p.setViewportSize({ width: 390, height: 844 }); await go('/');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Share outfit' }).first().click()]);
  await dl.saveAs(`${OUT}/share-card.png`);
  console.log('captured', fs.readdirSync(OUT).length, 'files; page errors:', errors);
  await b.close();
})().catch((e) => { console.error('FAILED', e.message.split('\n')[0]); process.exit(1); });
