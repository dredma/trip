# Trip page for Flight Tracker

Static page served by GitHub Pages at `https://dredma.github.io/trip/?t=TOKEN`.
A Flight Tracker user creates a link in the app; anyone with the link can follow
that trip (one flight or a connection) live without installing the app.

* No build step, no dependencies, no cookies, no storage, no analytics, no third-party fonts or scripts.
* Data comes from the Supabase Edge Function `trip` (source in the app repo,
  `server/supabase/functions/trip`). `config.js` holds the project URL and the
  **anon (public) key**, which is public by design.
* Contains no personal data. Links expire 12 h after the last flight lands.

Local test: `python3 -m http.server` and open `http://localhost:8000/?t=<token>`.
