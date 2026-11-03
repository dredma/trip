(function () {
  var q = new URLSearchParams(location.search);
  var h = new URLSearchParams(location.hash.replace(/^#/, ''));
  function g(k) { return h.get(k) || q.get(k); }
  var err = g('error') || g('error_code');
  var type = g('type');
  var accessToken = g('access_token');
  var refreshToken = g('refresh_token');
  var code = g('code');
  // Magic links are only sent by the account-deletion page: hand the token
  // over to it (fragment only, never sent to a server) and stop here.
  if (type === 'magiclink' || q.get('next') === 'delete') {
    location.replace('../delete/' + (location.hash || ''));
    return;
  }
  // Drop tokens from the address bar and history immediately; never stored.
  try { history.replaceState(null, '', location.pathname); } catch (e) {}

  var t = document.getElementById('title');
  var m = document.getElementById('msg');
  var form = document.getElementById('reset-form');
  var formErr = document.getElementById('form-err');

  function cfg() {
    var c = window.TRIP_CONFIG || {};
    var base = (c.functionUrl || '').replace(/\/functions\/v1\/.*$/, '');
    return { url: base, anon: c.anonKey || '' };
  }

  function showErr(msg) {
    t.textContent = 'Link expired or already used';
    m.textContent = msg ||
      'This link is no longer valid. Request a new one from the Flight Tracker app.';
    form.hidden = true;
  }

  if (err) {
    showErr();
    return;
  }

  if (type === 'recovery') {
    t.textContent = 'Choose a new password';
    m.textContent = 'Enter a new password for your Flight Tracker account (at least 6 characters).';
    if (!accessToken && !code) {
      showErr('This recovery link is missing tokens. Request a new one from the Flight Tracker app.');
      return;
    }
    form.hidden = false;

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      formErr.hidden = true;
      var pw = document.getElementById('pw').value;
      var pw2 = document.getElementById('pw2').value;
      if (pw.length < 6) {
        formErr.textContent = 'Use at least 6 characters.';
        formErr.hidden = false;
        return;
      }
      if (pw !== pw2) {
        formErr.textContent = 'Passwords do not match.';
        formErr.hidden = false;
        return;
      }
      var c = cfg();
      if (!c.url || !c.anon) {
        formErr.textContent = 'Page misconfigured. Try again later.';
        formErr.hidden = false;
        return;
      }
      var btn = document.getElementById('submit');
      btn.disabled = true;
      btn.textContent = 'Saving…';

      function putPassword(token) {
        return fetch(c.url + '/auth/v1/user', {
          method: 'PUT',
          headers: {
            'apikey': c.anon,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: pw }),
          credentials: 'omit',
          cache: 'no-store'
        });
      }

      function onFail() {
        btn.disabled = false;
        btn.textContent = 'Set new password';
        showErr('Could not update the password (link may be expired). Request a new reset link from the Flight Tracker app.');
      }

      function onOk() {
        form.hidden = true;
        t.textContent = 'Password updated ✓';
        m.textContent = 'Password updated. Open Flight Tracker and sign in.';
      }

      var start = accessToken
        ? Promise.resolve(accessToken)
        : fetch(c.url + '/auth/v1/token?grant_type=pkce', {
            method: 'POST',
            headers: {
              'apikey': c.anon,
              'Authorization': 'Bearer ' + c.anon,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ auth_code: code }),
            credentials: 'omit',
            cache: 'no-store'
          }).then(function (r) {
            if (!r.ok) throw new Error('pkce');
            return r.json();
          }).then(function (j) {
            if (!j.access_token) throw new Error('pkce');
            return j.access_token;
          });

      start.then(putPassword).then(function (r) {
        if (!r.ok) throw new Error('put');
        onOk();
      }).catch(onFail);
    });
    return;
  }

  // Confirm-email (and any other) success path — unchanged.
  t.textContent = 'Email confirmed ✓';
  m.textContent = 'You can go back to the Flight Tracker app and sign in.';
})();
