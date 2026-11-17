# Nimbo website

Static site served by GitHub Pages at `https://nimbo.fly/`.

* The root is the public presentation of Nimbo.
* Live trip links are at `https://nimbo.fly/trip/?t=TOKEN`. Older links of the
  form `https://nimbo.fly/?t=TOKEN` (and `https://dredma.github.io/trip/?t=TOKEN`)
  redirect there, keeping the query string and hash.
* No build step, no cookies, no storage, no analytics, no third-party fonts
  or scripts. Nunito is self-hosted in `fonts/` (SIL Open Font License).

The trip page reads live data from the Supabase Edge Function `trip` (source
in the app repo, `server/supabase/functions/trip`). `config.js` holds the
project URL and the **anon (public) key**, which is public by design. Links
expire 12 h after the last flight lands.

Local test: `python3 -m http.server` and open `http://localhost:8000/` or
`http://localhost:8000/trip/?t=<token>`.

## Account deletion page

`https://nimbo.fly/delete/` is the public account-deletion URL for
Google Play. It explains the in-app path and lets people without the app
request deletion: the Edge Function `account-delete` (app repo) emails a
one-time Supabase sign-in link to the account address; `auth/` forwards the
link (`type=magiclink`) to `delete/`, where the user taps *Delete my account*
and the function runs the same `delete_my_account` RPC as the app.
Test: `node tests/delete_page_test.js` (needs jsdom).

## Terms of Service

`https://nimbo.fly/terms/` is the public Terms of Service for
Google Play (trader-status / in-app purchases). Styled like the deletion
page (sunset palette, self-hosted Nunito). The in-app copy lives in the app
repo as `docs/terms-of-service.md`.

## Google Play badge

The Play Store URL and live flag live in one place: `play.js`.

```js
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.kristian.nimbo";
const PLAY_LIVE = false;
```

Keep `PLAY_LIVE` at `false` until the listing is public. The landing then shows a
non-clickable “Coming soon on Google Play” label (not the official badge, and
not a link).

When the listing is live, set `PLAY_LIVE` to `true` and leave `PLAY_URL`
unchanged. The page then shows Google’s official “Get it on Google Play” badge
(`badges/google-play-badge.png`, unmodified) and links to that URL.

The official badge is used under
[Google Play badge guidelines](https://play.google.com/intl/en_us/badges/): only
to advertise the app on Google Play, and without altering the artwork.

## App screenshots

`shots/` holds device screenshots of the real app, captured from a test-only
harness in the app repo (`test/landing_screenshots_test.dart`) with made-up
demo data. Each shot is stored as AVIF and WebP, with a PNG fallback.

