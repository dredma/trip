// Old share links were https://nimbo.fly/?t=TOKEN. Send them to /trip/.
(function () {
  if (!new URLSearchParams(location.search).has("t")) return;
  location.replace("/trip/" + location.search + location.hash);
})();
