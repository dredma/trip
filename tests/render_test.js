// Render test + screenshots: npm i playwright-core; python3 -m http.server 8765 & node tests/render_test.js
const { chromium } = require('playwright-core');
const now = Date.parse("2026-10-22T15:19:00Z"), iso = (m) => new Date(now + m * 60000).toISOString();
const delay = { state: "active", display_name: "Kristian", expires_at: iso(14 * 60), live_enabled: true, legs: [
  { flight_no: "LH1411", airline: "Lufthansa", dep: "ZAG", arr: "FRA", date: "2026-10-22", dep_utc: iso(-95), arr_utc: iso(5), dep_tz: "Europe/Zagreb", arr_tz: "Europe/Berlin", fetched_at: iso(-6),
    live: { status: "EnRoute", aircraft: "Airbus A320neo", dep: { expected: iso(-55), actual: iso(-52), terminal: "1", gate: "B4" }, arr: { expected: iso(42), terminal: "1", gate: "A26" } } },
  { flight_no: "LH400", airline: "Lufthansa", dep: "FRA", arr: "JFK", date: "2026-10-22", dep_utc: iso(75), arr_utc: iso(600), dep_tz: "Europe/Berlin", arr_tz: "America/New_York", fetched_at: iso(-6),
    live: { status: "Expected", dep: { expected: iso(75), gate: "Z25" }, arr: { expected: iso(590) } } } ] };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };
  for (const [name, q, status, body] of [["share_trip_delay", "", 200, delay], ["share_trip_delay_12h", "&h=12", 200, delay], ["share_trip_dmy_dot", "&d=dmy_dot", 200, delay], ["share_trip_iso_12h", "&h=12&d=iso", 200, delay], ["share_trip_bad_d", "&d=zzz", 200, delay], ["share_expired", "", 410, { state: "expired" }]]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "en-US", timezoneId: "Europe/Zagreb" });
    await ctx.addInitScript(`{ const N=${now}; const D=Date; Date.now=()=>N; }`);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.route('https://vtjtiyypfjjgbakziyjs.supabase.co/**', r => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
    await p.goto('http://localhost:8765/?t=AbCdEfGhIjKlMnOpQrStUv' + q); await p.waitForTimeout(700);
    const txt = await p.innerText('body');
    if (name === "share_trip_delay") {
      ok(/\b16:27\b/.test(txt) && !/\d (AM|PM)/.test(txt), "24h default even with en-US browser locale");
      ok(/Thu 22 Oct/.test(txt), "neutral date");
      ok(/page checked 17:19/.test(txt) && /valid until Fri 23 Oct 01:19/.test(txt), "checked/expiry in 24h");
      await p.click('#hfmt button[data-h="12"]');
      const t2 = await p.innerText('body');
      ok(/4:27 PM/.test(t2) && p.url().endsWith("&h=12"), "toggle -> AM/PM + URL h=12");
      await p.click('#hfmt button[data-h="24"]');
      ok(!p.url().includes("h=12") && /16:27/.test(await p.innerText('body')), "toggle back to 24h");
      const ck = await ctx.cookies(); const ls = await p.evaluate(() => localStorage.length + sessionStorage.length);
      ok(ck.length === 0 && ls === 0, "no cookies/storage");
    }
    if (name === "share_trip_delay_12h") ok(/4:27 PM/.test(txt) && (await p.getAttribute("button[data-h=\"12\"]", "aria-pressed")) === "true", "h=12 param");
    if (name === "share_trip_dmy_dot") ok(/22\.10\.2026/.test(txt) && /valid until 23\.10\.2026 01:19/.test(txt) && !/Thu 22 Oct/.test(txt), "d=dmy_dot");
    if (name === "share_trip_iso_12h") {
      ok(/2026-10-22/.test(txt) && /4:27 PM/.test(txt), "d=iso + h=12");
      await p.click('#hfmt button[data-h="24"]');
      ok(p.url().includes("d=iso") && !p.url().includes("h=12"), "toggle keeps d");
    }
    if (name === "share_trip_bad_d") ok(/Thu 22 Oct/.test(txt), "unknown d -> default");
    await p.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
    ok(errs.length === 0, name + " no JS errors " + errs.join("|"));
    await ctx.close();
  }
  await b.close(); process.exit(fail ? 1 : 0);
})();
