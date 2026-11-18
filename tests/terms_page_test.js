// node tests/terms_page_test.js
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../terms/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../terms/terms.css'), 'utf8');

function ok(c, m) { if (!c) throw new Error(m); }

ok(/Last updated 18 November 2026/.test(html), 'date');
ok(/Kristian Popovic/.test(html), 'provider');
ok(/contact@nimbo.fly/.test(html), 'email');
ok(!/Who provides Nimbo|Location:/.test(html) && !/Brace|52210/.test(html), 'no provider section, city only');
ok(/<footer class="foot">\s*<p>Nimbo is provided by Kristian Popovic \(“we”, “us”\), Rovinj, Croatia · <a href="mailto:contact@nimbo\.fly">/.test(html), 'provider in footer');
ok(!/app id|com\.kristian\.nimbo/.test(html), 'no app id');
ok(!/To be completed/.test(html), 'no address placeholder');
ok(!/once it is completed/.test(html), 'contact uses address');
ok(!/pro_lifetime/.test(html), 'no product id');
ok(!/own API key/.test(html), 'no API key sentence');
ok(!/Questions about these terms|<h2>Contact<\/h2>/.test(html), 'no contact section');
ok(!/quotas, rate limits/.test(html) && /Try to bypass Pro or security/.test(html), 'no quotas wording');
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
ok(!/Rovinj|Kristian Popovic|Controller\./.test(privacy), 'trip-link privacy has no controller address');
ok(/Who is responsible\.<\/b> See our <a href="\.\/privacy\/">privacy policy<\/a>/.test(privacy) && /mailto:privacy@nimbo\.fly/.test(privacy), 'trip-link privacy points to policy');
ok(!/contact details to be completed/.test(privacy), 'no privacy placeholder');
ok(/href="\.\/terms\/"/.test(privacy), 'privacy links to terms');
const del = fs.readFileSync(path.join(__dirname, '../delete/index.html'), 'utf8');
ok(!/class="dev"/.test(del) && (del.match(/developer Kristian Popovic/g) || []).length === 1 && /<footer class="foot">\s*<p>Nimbo · developer Kristian Popovic/.test(del), 'delete page: developer line only in footer');
ok(/href="\.\.\/terms\/"/.test(del), 'delete links to terms');
ok(/<h2>Delete your account without the app<\/h2>/.test(del) && /confirm deleting your account and cloud data/.test(del) && />Send deletion link<\/button>/.test(del) && !/No app any more/.test(del), 'web deletion form is explicit');

const policy = fs.readFileSync(path.join(__dirname, '../privacy/index.html'), 'utf8');
ok(!/Who is responsible/.test(policy), 'no controller section');
ok(!/own API key/.test(policy + privacy), 'policy has no API key sentence');
ok(/<footer class="foot">\s*<p>Nimbo flight log app for Android, by developer Kristian Popovic, Rovinj, Croatia · contact@nimbo\.fly<\/p>/.test(policy), 'controller in footer');
ok(/write to privacy@nimbo\.fly/.test(policy), 'rights email kept');
ok(/privacy@nimbo.fly/.test(policy), 'policy email');
ok(/<p>Effective and last updated: 18 November 2026<\/p>/.test(policy) && !/draft|not yet reviewed/i.test(policy + html + del + privacy), 'policy date, no draft label');
ok(!/to be completed/.test(policy), 'no policy placeholder');

ok(!/Flight Tracker/.test(privacy), 'trip-link note uses the Nimbo name');
ok(!/Brace|52210/.test(privacy + policy), 'city and country only');

// Feedback mailto in every legal footer and on the landing page.
for (const f of ['../index.html', '../privacy/index.html', '../terms/index.html', '../delete/index.html', '../privacy.html']) {
  const h = fs.readFileSync(path.join(__dirname, f), 'utf8');
  ok(/<a href="mailto:contact@nimbo\.fly\?subject=Nimbo%20feedback">Feedback<\/a>/.test(h), 'feedback link in ' + f);
}

console.log('ok    terms page');
