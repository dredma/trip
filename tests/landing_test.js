// node tests/landing_test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function ok(c, m) { if (!c) throw new Error(m); console.log('ok    ' + m); }

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'landing.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'redirect.js'), 'utf8');
const trip = fs.readFileSync(path.join(root, 'trip/index.html'), 'utf8');

ok(/<script src="redirect.js"><\/script>/.test(html), 'redirect script in head');
ok(html.indexOf('redirect.js') < html.indexOf('<title>'), 'redirect runs early');
ok(/Coming soon on Google Play/.test(html), 'Play badge');
ok(!/play\.google\.com|play.google.com/.test(html), 'no Play Store link');
ok(/contact@nimbo.fly/.test(html), 'contact email');
ok(/href="privacy\/"/.test(html), 'privacy link');
ok(/href="terms\/"/.test(html), 'terms link');
ok(/href="delete\/"/.test(html), 'delete link');
ok(/A private logbook for every flight you take/.test(html), 'tagline');
ok(/one-time lifetime unlock/.test(html), 'Pro lifetime');
ok(/7-day trial/.test(html), 'Pro trial');
ok(/not a subscription/.test(html), 'not a subscription');
ok(!/\(optional\)/i.test(html), 'no optional labels');
ok(!/\b(AM|PM)\b/.test(html), 'no 12h examples');
ok(/og\.png/.test(html) && /favicon\.png/.test(html), 'favicon and OG image');
ok(/Content-Security-Policy/.test(html), 'csp');
ok(!/googletagmanager|google-analytics|gtag\(|plausible|analytics\.js/.test(html), 'no trackers');
ok(/Nunito/.test(css) && /nunito-latin\.woff2/.test(css), 'self-hosted Nunito');
ok(/#441E8D/.test(css) && /#FD6229/.test(css), 'sunset palette');
ok(/app\.js/.test(trip) && /config\.js/.test(trip), 'viewer still loads scripts');
ok(/href="\.\.\/privacy\.html"/.test(trip), 'viewer privacy path');
ok(/noindex/.test(trip), 'viewer stays noindex');
ok(!/noindex/.test(html), 'landing is indexable');

function apply(href) {
  const u = new URL(href);
  let replaced = null;
  const context = {
    location: {
      search: u.search,
      hash: u.hash,
      replace(h) { replaced = h; },
    },
    URLSearchParams,
  };
  require('vm').runInNewContext(js, context);
  return replaced;
}

ok(apply('https://nimbo.fly/?t=AbCd') === '/trip/?t=AbCd', 'root ?t= redirects');
ok(apply('https://nimbo.fly/?t=AbCd&h=12&d=iso#x') === '/trip/?t=AbCd&h=12&d=iso#x', 'preserves query and hash');
ok(apply('https://nimbo.fly/') == null, 'root without t stays');
ok(apply('https://nimbo.fly/?h=12') == null, 'no redirect without t');

console.log('ok    landing page');
