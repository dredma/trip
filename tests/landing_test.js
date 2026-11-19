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
ok(/Your private logbook for every flight/.test(html), 'tagline');
ok(/Try it free/.test(html), 'primary CTA');
ok(/play\.js/.test(html) && /data-play/.test(html), 'Play slot and play.js');
ok(/shots\/globe-540\.(avif|webp|jpg)/.test(html) && /fetchpriority="high"/.test(html), 'globe hero screenshot');
const shotNames = [...html.matchAll(/shots\/([a-z]+)-540\.jpg/g)].map((m) => m[1]);
ok(shotNames.length === 14 && new Set(shotNames).size === 14, 'hero plus 13 gallery shots, no duplicates');
for (const n of shotNames) {
  for (const f of [`${n}-540.avif`, `${n}-1080.avif`, `${n}-540.webp`, `${n}-1080.webp`, `${n}-540.jpg`]) {
    if (!fs.existsSync(path.join(root, 'shots', f))) throw new Error('missing shots/' + f);
  }
}
ok(true, 'every shot has avif, webp (540w and 1080w) and a jpg fallback');
ok(/srcset="shots\/[a-z]+-540\.webp 540w, shots\/[a-z]+-1080\.webp 1080w"/.test(html), 'responsive srcset');
ok((html.match(/loading="lazy"/g) || []).length === 14, 'gallery shots and poster lazy-load');
ok(/shots\/poster-800\.webp 800w, shots\/poster-1600\.webp 1600w/.test(html) && fs.existsSync(path.join(root, 'shots/poster-1600.avif')) && fs.existsSync(path.join(root, 'shots/poster-800.jpg')), 'wide poster image');
ok(!/s1\.|booking|BFFL7X/i.test(html), 'no booking-code screenshot');
ok(/<script src="gallery.js"><\/script>/.test(html) && /\.strip\.carousel li\.focus/.test(css) && fs.existsSync(path.join(root, 'gallery.js')), 'desktop carousel when a row does not fit');
ok(/class="strip"/.test(html) && /scroll-snap-type: x mandatory/.test(css), 'swipeable gallery on phones');
for (const id of ['globe', 'log', 'stats', 'fun']) ok(html.includes(`id="${id}"`), `gallery group ${id}`);
ok(/type="image\/avif"/.test(html) && /type="image\/webp"/.test(html), 'avif and webp sources');
ok(/loading="lazy"/.test(html), 'lazy-load below-fold shots');
ok(/No account needed|no account needed/.test(html), 'no account needed');
ok(/local-first/.test(html), 'local-first');
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
ok(/70vh/.test(css) && /max-width: 320px/.test(css), 'phone frames capped on large screens');
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


const play = fs.readFileSync(path.join(root, 'play.js'), 'utf8');
ok(/const PLAY_URL = "https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.kristian\.nimbo"/.test(play), 'Play URL in play.js');
ok(/const PLAY_LIVE = false/.test(play), 'Play listing flagged as not live');
ok(!/PLAY_LIVE = true/.test(play), 'Play listing is not live yet');

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
ok(/document\.title = .* · Nimbo/.test(app), 'viewer document title uses Nimbo');
ok(!/Flight Tracker/.test(app), 'viewer JS has no Flight Tracker title');


// FAQ and Open Graph image
ok(/class="faq" id="faq"/.test(html) && html.indexOf('id="faq"') < html.indexOf('id="try"'), 'FAQ section before Try it free');
ok((html.match(/<details>/g) || []).length === 7 && (html.match(/<summary>/g) || []).length === 7, 'seven FAQ details accordions');
const faq = html.slice(html.indexOf('id="faq"'), html.indexOf('id="try"'));
ok(/href="privacy\/"/.test(faq), 'FAQ links to privacy/');
ok(/href="delete\/"/.test(faq), 'FAQ links to delete/');
ok(/AeroDataBox/.test(faq) && !/RapidAPI|API key/.test(faq), 'live data from AeroDataBox, no API key in FAQ');
ok(/application\/ld\+json/.test(html) && /FAQPage/.test(html), 'FAQPage JSON-LD');
ok(/og:image" content="https:\/\/nimbo\.fly\/og\.png"/.test(html) && /og:image:width" content="1200"/.test(html) && /og:image:height" content="630"/.test(html), 'og:image with width and height');
ok(/twitter:card" content="summary_large_image"/.test(html) && /twitter:image" content="https:\/\/nimbo\.fly\/og\.png"/.test(html), 'twitter large image card');
const og = fs.readFileSync(path.join(root, 'og.png'));
ok(og[0] === 0x89 && og.toString('ascii', 1, 4) === 'PNG', 'og.png is a PNG');
ok(og.readUInt32BE(16) === 1200 && og.readUInt32BE(20) === 630, 'og.png is 1200x630');
ok(og.length < 300 * 1024, 'og.png under 300 KB');
ok(/landing\.css\?v=9/.test(html) && /\.faq details/.test(css), 'FAQ styles and cache bump');

console.log('ok    landing page');
