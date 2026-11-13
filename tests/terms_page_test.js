// node tests/terms_page_test.js
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../terms/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../terms/terms.css'), 'utf8');

function ok(c, m) { if (!c) throw new Error(m); }

ok(/Last updated 13 November 2026/.test(html), 'date');
ok(/Kristian Popovic/.test(html), 'provider');
ok(/popovickristian@gmail.com/.test(html), 'email');
ok(/To be completed: the legal address/.test(html), 'address placeholder');
ok(/pro_lifetime/.test(html), 'product id');
ok(/not a subscription/.test(html), 'lifetime unlock');
ok(/14-day right of withdrawal/.test(html), 'EU withdrawal');
ok(/Pro features switch off/.test(html), 'pro lost');
ok(/Pro avatar you already chose stays/.test(html), 'avatar kept');
ok(/trip links you already created stay/.test(html), 'links kept');
ok(/not an operational or safety/.test(html), 'accuracy disclaimer');
ok(/Republic of Croatia/.test(html), 'governing law');
ok(/mandatory rights as a consumer/.test(html), 'consumer rights');
ok(/href="\.\.\/privacy\.html"/.test(html), 'relative privacy link');
ok(/href="\.\.\/delete\/"/.test(html), 'relative delete link');
ok(!/legal advice/.test(html.toLowerCase()), 'no legal-advice disclaimer');
ok(/url\("\.\.\/fonts\/nunito-latin\.woff2"\)/.test(css), 'relative font path');
ok(/font-src 'self'/.test(html), 'csp fonts');
ok(!/script-src/.test(html), 'no scripts');

const privacy = fs.readFileSync(path.join(__dirname, '../privacy.html'), 'utf8');
ok(/href="\.\/terms\/"/.test(privacy), 'privacy links to terms');
const del = fs.readFileSync(path.join(__dirname, '../delete/index.html'), 'utf8');
ok(/href="\.\.\/terms\/"/.test(del), 'delete links to terms');

console.log('ok    terms page');
