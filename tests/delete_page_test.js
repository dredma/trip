// node tests/delete_page_test.js  (needs jsdom; skips otherwise)
const fs = require('fs');
const path = require('path');
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();
const tick = () => new Promise((r) => setTimeout(r, 20));

function load(url, fetchImpl) {
  const html = fs.readFileSync(path.join(__dirname, '../delete/index.html'), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const w = dom.window;
  w.TRIP_CONFIG = { functionUrl: 'https://sb.test/functions/v1/trip', anonKey: 'anon' };
  w.fetch = fetchImpl;
  w.eval(fs.readFileSync(path.join(__dirname, '../delete/delete.js'), 'utf8'));
  return w;
}
function ok(c, m) { if (!c) throw new Error(m); }

async function main() {
  if (!JSDOM) { console.log('skip  jsdom not installed'); return; }
  // Request step
  let sent;
  let w = load('https://dredma.github.io/trip/delete/', async (u, o) => { sent = { u, b: JSON.parse(o.body) }; return { ok: true, status: 200 }; });
  ok(!w.document.getElementById('request-form').hidden, 'form visible');
  ok(w.document.getElementById('confirm-box').hidden, 'confirm hidden');
  w.document.getElementById('email').value = 'a@example.com';
  w.document.getElementById('request-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await tick();
  ok(sent.u === 'https://sb.test/functions/v1/account-delete', 'function url');
  ok(sent.b.action === 'request' && sent.b.email === 'a@example.com', 'body');
  ok(/sign-in link/.test(w.document.getElementById('request-msg').textContent), 'msg');
  // Confirm step: no deletion without a click; click sends the user token
  let auth = null;
  w = load('https://dredma.github.io/trip/delete/#access_token=usertok&type=magiclink', async (u, o) => { auth = o.headers.Authorization; return { ok: true, status: 200 }; });
  ok(w.location.hash === '', 'token removed from URL');
  ok(!w.document.getElementById('confirm-box').hidden && w.document.getElementById('request-form').hidden, 'confirm shown');
  await tick();
  ok(auth === null, 'nothing sent before click');
  w.document.getElementById('confirm-btn').click();
  await tick();
  ok(auth === 'Bearer usertok', 'user token');
  ok(/deleted/.test(w.document.getElementById('confirm-title').textContent), 'done');
  // Auth page forwards magic links
  const ah = fs.readFileSync(path.join(__dirname, '../auth/index.html'), 'utf8');
  const ad = new JSDOM(ah, { url: 'https://dredma.github.io/trip/auth/#access_token=t&type=magiclink', runScripts: 'outside-only' });
  let to = null;
  const src = fs.readFileSync(path.join(__dirname, '../auth/auth.js'), 'utf8').replace('location.replace(', 'window.__go=(');
  ad.window.eval(src);
  to = ad.window.__go;
  ok(to === '../delete/#access_token=t&type=magiclink', 'forward ' + to);
  console.log('ok    delete page');
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
