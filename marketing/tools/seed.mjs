// Seeds a realistic, lived-in closet (womenswear sample closet, 2+ weeks of wear history,
// saved outfits, planned days, a trip and a wishlist piece) for screenshots and the promo video.
const BASE = process.env.BASE_URL || 'http://localhost:3100';

/** Deterministic sample weather so marketing shots never show a loading or rate-limited state. */
async function mockWeather(ctx) {
  const days = 16;
  const time = [...Array(days)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
  const max = [17, 16, 18, 19, 15, 14, 16, 18, 20, 21, 19, 17, 16, 18, 19, 20];
  await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: {
    current: { temperature_2m: 15, apparent_temperature: 13, weather_code: 2 },
    daily: { time, temperature_2m_max: max.slice(0, days), temperature_2m_min: max.map((m) => m - 7), precipitation_probability_max: max.map((m, i) => (i % 4 === 1 ? 60 : 10)) },
  } }));
  await ctx.route('https://geocoding-api.open-meteo.com/**', (r) => {
    const q = new URL(r.request().url()).searchParams.get('name') || '';
    const city = /lis/i.test(q) ? { name: 'Lisbon', latitude: 38.72, longitude: -9.13, country: 'Portugal', admin1: 'Lisbon' } : { name: 'Paris', latitude: 48.85, longitude: 2.35, country: 'France', admin1: 'Île-de-France' };
    r.fulfill({ json: { results: [city] } });
  });
}
async function idb(p, fn, arg) { return p.evaluate(fn, arg); }
async function seed(p, { trip = true } = {}) {
  await p.goto(BASE + '/');
  await p.waitForURL('**/onboarding');
  await p.getByRole('button', { name: /Find my style/ }).click();
  await p.getByRole('button', { name: 'Womenswear' }).click();
  await p.getByRole('button', { name: /Work/ }).click();
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: /Skip for now/ }).click();
  for (let i = 0; i < 10; i++) {
    const t = await p.locator('p.text-\\[17px\\]').last().textContent();
    const like = /tee|knit|trench|blazer|coat|denim|black dress|cardigan|white shirt/i.test(t);
    await p.getByRole('button', { name: like ? "I'd wear it" : 'Not for me' }).click();
    await p.waitForTimeout(220);
  }
  await p.getByRole('button', { name: /show my result/ }).click();
  await p.getByRole('button', { name: /do it later/ }).click();
  await p.getByRole('button', { name: /Try a sample closet/ }).click();
  await p.getByText('Your outfits').waitFor({ timeout: 20000 });
  // Leave a few catalogue pieces out of the closet so "Smart buys" has something to suggest.
  await idb(p, () => new Promise((res) => {
    const r = indexedDB.open('bgadai');
    r.onsuccess = () => {
      const tx = r.result.transaction('items', 'readwrite'); const st = tx.objectStore('items');
      st.getAll().onsuccess = (e) => { for (const i of e.target.result) if (['blazer-black', 'boots-brown', 'cardigan-cream', 'loafers-brown'].includes(i.sample)) st.delete(i.id); };
      tx.oncomplete = () => res();
    };
  }));
  // City + history directly in IndexedDB (avoids rate-limited geocoding).
  await idb(p, () => new Promise((res) => {
    const r = indexedDB.open('bgadai');
    r.onsuccess = () => {
      const tx = r.result.transaction(['profile', 'items', 'wearLogs', 'outfits'], 'readwrite');
      const prof = tx.objectStore('profile'); const items = tx.objectStore('items'); const logs = tx.objectStore('wearLogs');
      prof.get('me').onsuccess = (e) => { const pr = e.target.result; pr.city = { name: 'Paris', latitude: 48.8534, longitude: 2.3488, country: 'France' }; prof.put(pr); };
      items.getAll().onsuccess = (e) => {
        const all = e.target.result;
        const by = (c) => all.filter((i) => i.category === c);
        const tops = by('top'), bottoms = by('bottom'), shoes = by('shoes'), outer = by('outerwear');
        const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const counts = {};
        for (let k = 1; k <= 16; k++) {
          if (k % 5 === 0) continue; // a few skipped days look natural
          const d = new Date(); d.setDate(d.getDate() - k);
          const ids = [tops[k % tops.length], bottoms[(k * 3) % bottoms.length], shoes[k % shoes.length]];
          if (k % 3 === 0 && outer.length) ids.push(outer[k % outer.length]);
          logs.put({ id: 'seed-' + k, date: key(d), itemIds: ids.map((i) => i.id) });
          ids.forEach((i) => { counts[i.id] = (counts[i.id] || 0) + 1; i.lastWornAt = Math.max(i.lastWornAt || 0, d.getTime()); });
        }
        for (const i of all) {
          if (counts[i.id]) i.wearCount = counts[i.id];
          if (i.subcategory === 'blazer') i.price = 120;
          if (i.subcategory === 'jeans') i.price = 80;
          if (i.subcategory === 'sneakers') i.price = 95;
          items.put(i);
        }
      };
      tx.oncomplete = () => res();
    };
  }));
  await p.reload();
  await p.getByText('Your outfits').waitFor({ timeout: 20000 });
  await p.getByRole('button', { name: 'Save' }).first().click();
  await p.getByRole('button', { name: 'Save' }).nth(1).click();
  await p.getByRole('button', { name: 'Wear today' }).first().click();
  await p.waitForTimeout(400);
  // Plan two days
  await p.getByRole('link', { name: 'Plan', exact: true }).first().click();
  await p.waitForTimeout(700);
  for (const n of [1, 2]) {
    await p.locator('main button').filter({ hasText: '+ Plan' }).first().click();
    await p.getByRole('button', { name: 'Plan this' }).nth(n - 1).click();
    await p.waitForTimeout(350);
  }
  if (trip) {
    await p.getByRole('button', { name: '+ New trip' }).click();
    const dlg = p.locator('dialog[open]');
    await dlg.getByPlaceholder('City').fill('Lisbon');
    let ok = false;
    for (let k = 0; k < 4 && !ok; k++) {
      await dlg.getByRole('button', { name: 'Search' }).click();
      ok = await dlg.getByRole('button', { name: /Lisbon.*Portugal/ }).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    }
    if (ok) {
      await dlg.getByRole('button', { name: /Lisbon.*Portugal/ }).first().click();
      await dlg.getByRole('button', { name: /Plan outfits & packing list/ }).click();
      await p.getByText('Packing list').waitFor({ timeout: 30000 }).catch(() => {});
      await p.locator('dialog[open] input[type=checkbox]').nth(0).click().catch(() => {});
      await p.locator('dialog[open] input[type=checkbox]').nth(1).click().catch(() => {});
      await p.locator('dialog[open]').getByRole('button', { name: 'Close' }).click().catch(() => {});
    } else {
      await dlg.getByRole('button', { name: 'Close' }).click().catch(() => p.keyboard.press('Escape'));
    }
  }
  // Wishlist piece
  await p.getByRole('link', { name: 'Inspo', exact: true }).first().click();
  await p.getByRole('button', { name: 'Before you buy' }).click();
  await p.getByRole('button', { name: 'Shoes', exact: true }).click();
  await p.getByRole('button', { name: 'Boots', exact: true }).click();
  await p.getByRole('button', { name: 'burgundy', exact: true }).click();
  await p.getByRole('button', { name: 'Check by type' }).click();
  await p.getByRole('button', { name: /Save to wishlist/ }).click();
  await p.waitForTimeout(300);
}
export { seed, mockWeather, BASE };
