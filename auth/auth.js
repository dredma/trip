(function () {
  var q = new URLSearchParams(location.search);
  var h = new URLSearchParams(location.hash.replace(/^#/, ''));
  function g(k) { return h.get(k) || q.get(k); }
  var err = g('error') || g('error_code'), type = g('type');
  // Drop tokens from the address bar and history immediately; never stored or sent.
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  var t = document.getElementById('title'), m = document.getElementById('msg');
  if (err) {
    t.textContent = 'Link expired or already used';
    m.textContent = 'This link is no longer valid. Request a new one from the Flight Tracker app.';
  } else if (type === 'recovery') {
    t.textContent = 'Password reset';
    m.textContent = 'Go back to the Flight Tracker app to continue. If you cannot sign in there, request a new link from the app.';
  } else {
    t.textContent = 'Email confirmed ✓';
    m.textContent = 'You can go back to the Flight Tracker app and sign in.';
  }
})();
