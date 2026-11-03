// Account deletion without the app. Step 1: POST {action:"request", email} to
// the Edge Function `account-delete`, which asks Supabase Auth to email a
// one-time sign-in link (existing accounts only). The link opens ../auth/,
// which forwards here with the token in the URL fragment. Step 2: the user
// taps "Delete my account" -> POST {action:"confirm"} with that token; the
// function runs the same delete_my_account RPC as the app. Nothing is stored.
(function () {
  var c = window.TRIP_CONFIG || {};
  var base = (c.functionUrl || '').replace(/\/functions\/v1\/.*$/, '');
  var FN = base + '/functions/v1/account-delete';
  var h = new URLSearchParams(location.hash.replace(/^#/, ''));
  var token = h.get('access_token');
  var linkErr = h.get('error') || h.get('error_code');
  if (location.hash) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  function say(el, text, cls) { el.textContent = text; el.className = 'note ' + (cls || ''); el.hidden = false; }
  function call(body, auth) {
    var headers = { 'Content-Type': 'application/json', 'apikey': c.anonKey || '' };
    headers.Authorization = 'Bearer ' + (auth || c.anonKey || '');
    return fetch(FN, { method: 'POST', headers: headers, body: JSON.stringify(body), credentials: 'omit', cache: 'no-store' });
  }

  var form = $('request-form'), box = $('confirm-box');

  if (token || linkErr) {
    form.hidden = true;
    box.hidden = false;
    try { $('web').scrollIntoView(); } catch (e) {}
    if (!token) {
      $('confirm-title').textContent = 'Link expired or already used';
      $('confirm-text').textContent = 'Request a new link below.';
      $('confirm-btn').hidden = true;
      form.hidden = false;
    }
  }

  $('confirm-btn').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    call({ action: 'confirm' }, token).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      token = null;
      btn.hidden = true;
      $('confirm-title').textContent = 'Account deleted ✓';
      $('confirm-text').textContent = 'Your Nimbo account and its server data were deleted.';
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Delete my account';
      say($('confirm-msg'), e.message === '401'
        ? 'This link has expired. Request a new one below.'
        : 'Could not delete right now. Please try again.', 'err');
      if (e.message === '401') { btn.hidden = true; form.hidden = false; }
    });
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('email').value.trim();
    var msg = $('request-msg'), btn = $('request-btn');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say(msg, 'Please enter a valid email.', 'err'); return; }
    btn.disabled = true;
    call({ action: 'request', email: email }).then(function (r) {
      if (r.status === 429) throw new Error('429');
      if (!r.ok) throw new Error(String(r.status));
      say(msg, 'If an account exists for this email, we sent a sign-in link. Open it and tap Delete my account. The link is valid for one hour.', 'ok');
    }).catch(function (e) {
      btn.disabled = false;
      say(msg, e.message === '429' ? 'Too many requests. Please try again in an hour.' : 'Something went wrong. Please try again.', 'err');
    });
  });
})();
