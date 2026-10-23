// Manual/CI-lite check: load auth.js against a fake DOM + hash, assert form shows
// and PUT /auth/v1/user is called. Run: node tests/auth_recovery_test.js
const fs = require('fs');
const path = require('path');
const { JSDOM } = (() => { try { return require('jsdom'); } catch (e) { return {}; } })();

async function main() {
  if (!JSDOM) {
    console.log('skip  jsdom not installed — manual check notes below');
    console.log('MANUAL: open https://dredma.github.io/trip/auth/#access_token=x&refresh_token=y&type=recovery');
    console.log('  expect form; expired token -> request new link message');
    console.log('  confirm-email path (?type=signup or bare) still says Email confirmed');
    process.exit(0);
  }
  const html = fs.readFileSync(path.join(__dirname, '../auth/index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://dredma.github.io/trip/auth/#access_token=tok&refresh_token=ref&type=recovery',
    runScripts: 'outside-only',
    beforeParse(window) {
      window.TRIP_CONFIG = {
        functionUrl: 'https://vtjtiyypfjjgbakziyjs.supabase.co/functions/v1/trip',
        anonKey: 'anon-test',
      };
      window.fetch = async (url, opts) => {
        if (String(url).endsWith('/auth/v1/user') && opts.method === 'PUT') {
          const body = JSON.parse(opts.body);
          if (body.password === 'secret12' && opts.headers.Authorization === 'Bearer tok') {
            return { ok: true, status: 200, json: async () => ({}) };
          }
        }
        return { ok: false, status: 401, json: async () => ({}) };
      };
    },
  });
  const { window } = dom;
  const script = fs.readFileSync(path.join(__dirname, '../auth/auth.js'), 'utf8');
  window.eval(script);
  const form = window.document.getElementById('reset-form');
  if (form.hidden) throw new Error('form should be visible for recovery');
  window.document.getElementById('pw').value = 'secret12';
  window.document.getElementById('pw2').value = 'secret12';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 50));
  const title = window.document.getElementById('title').textContent;
  if (!/Password updated/.test(title)) throw new Error('expected success title, got ' + title);
  console.log('ok   recovery form + PUT password');
}

main().catch((e) => { console.error(e); process.exit(1); });
