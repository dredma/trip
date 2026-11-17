// Google Play listing for Nimbo (com.kristian.nimbo).
//
// Flip PLAY_LIVE to true when the listing is public. PLAY_URL is the official
// store page. Until then the landing shows a non-clickable “Coming soon on
// Google Play” label. When live, it becomes the official “Get it on Google
// Play” badge and links to PLAY_URL. See the README.
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.kristian.nimbo";
const PLAY_LIVE = false;

(function () {
  if (!PLAY_LIVE) return;
  document.querySelectorAll("[data-play]").forEach((el) => {
    const a = document.createElement("a");
    a.href = PLAY_URL;
    a.className = "play-badge";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", "Get it on Google Play");
    const img = document.createElement("img");
    img.src = "badges/google-play-badge.png";
    img.alt = "Get it on Google Play";
    img.width = 155;
    img.height = 60;
    img.decoding = "async";
    a.appendChild(img);
    el.replaceChildren(a);
  });
})();
