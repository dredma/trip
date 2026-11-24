"use strict";
// Trip page: reads ?t=TOKEN, calls the Supabase Edge Function `trip`, renders.
// No cookies, no storage, no third-party requests.
(function () {
  const cfg = window.TRIP_CONFIG;
  const $ = (id) => document.getElementById(id);
  const main = $("main");
  const token = new URLSearchParams(location.search).get("t") || "";
  const MIN = 60000;
  let timer = null, lastData = null, lastOk = null;

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v; else if (k === "width") e.style.width = v;
      else if (k === "left") e.style.left = v; else e.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
    return e;
  }

  const ms = (s) => (s ? Date.parse(s) : NaN);
  // 24 h (HH:mm) by default; ?h=12 switches to AM/PM.
  // Dates "Thu 22 Oct" by default; ?d=dmy_dot|dmy_slash|mdy|iso mirrors the app's date format.
  const dStyle = new URLSearchParams(location.search).get("d") || "";
  let h12 = new URLSearchParams(location.search).get("h") === "12";
  function fmtTime(iso, tz) {
    if (!iso) return "–";
    const o = h12 ? { hour: "numeric", minute: "2-digit", hour12: true } : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
    const loc = h12 ? "en-US" : "en-GB";
    try { return new Intl.DateTimeFormat(loc, { ...o, timeZone: tz || undefined }).format(new Date(iso)); }
    catch { return new Intl.DateTimeFormat(loc, { ...o, timeZone: "UTC" }).format(new Date(iso)) + " UTC"; }
  }
  function fmtDay(iso, tz) {
    const f = (z) => {
      const n = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: z })
        .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
      if (dStyle === "dmy_dot") return `${n.day}.${n.month}.${n.year}`;
      if (dStyle === "dmy_slash") return `${n.day}/${n.month}/${n.year}`;
      if (dStyle === "mdy") return `${n.month}/${n.day}/${n.year}`;
      if (dStyle === "iso") return `${n.year}-${n.month}-${n.day}`;
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: z })
        .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
      return `${parts.weekday} ${parts.day} ${parts.month}`;
    };
    try { return f(tz || undefined); } catch { try { return f("UTC"); } catch { return ""; } }
  }
  function dur(m) {
    m = Math.round(Math.abs(m));
    const hh = Math.floor(m / 60), mm = m % 60;
    return hh ? `${hh} h ${String(mm).padStart(2, "0")} min` : `${mm} min`;
  }
  function ago(t) {
    const m = Math.round((Date.now() - t) / MIN);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
  }

  // Best times for a leg: actual > expected > scheduled.
  function times(leg) {
    const L = leg.live || {}, d = L.dep || {}, a = L.arr || {};
    const depS = leg.dep_utc, arrS = leg.arr_utc;
    return {
      depS, arrS, depTz: leg.dep_tz || d.tz, arrTz: leg.arr_tz || a.tz,
      depBest: d.actual || d.expected || depS, depActual: d.actual,
      arrBest: a.actual || a.expected || arrS, arrActual: a.actual,
    };
  }

  const STATUS = {
    Expected: ["Scheduled", ""], Unknown: ["Scheduled", ""], CheckIn: ["Check-in", ""],
    Boarding: ["Boarding", "warn"], GateClosed: ["Gate closed", "warn"], Departed: ["Departed", "ok"],
    EnRoute: ["In the air", "ok"], Approaching: ["Landing soon", "ok"], Arrived: ["Landed", "ok"],
    Delayed: ["Delayed", "bad"], Canceled: ["Cancelled", "bad"], CanceledUncertain: ["Maybe cancelled", "bad"],
    Diverted: ["Diverted", "bad"],
  };
  function statusOf(leg, t) {
    const s = leg.live && leg.live.status;
    const now = Date.now();
    // Without live data never guess landed/departed: a delayed flight may still be
    // on the ground or in the air. Only well past scheduled arrival (+6 h) say so.
    let [label, cls] = STATUS[s] || (!leg.live && now > ms(t.arrS) + 6 * 3600000 ? ["No live data", ""]
      : !leg.live && now > ms(t.depS) - 6 * 3600000 ? ["Awaiting live data", ""] : ["Scheduled", ""]);
    const late = (ms(t.depBest) - ms(t.depS)) / MIN;
    if ((label === "Scheduled" || label === "Check-in") && late >= 15) { label = "Delayed"; cls = "bad"; }
    return { label, cls, inAir: s === "EnRoute" || s === "Departed" || s === "Approaching" };
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, ...kids) {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
    return e;
  }
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  function fmtN(n) { return Math.round(n).toLocaleString("en-US"); }
  function formatAlt(loc) {
    if (!loc) return null;
    const m = num(loc.alt_m), f = num(loc.alt_ft);
    const a = m != null ? fmtN(m) + " m" : null, b = f != null ? fmtN(f) + " ft" : null;
    return a && b ? a + " · " + b : a || b;
  }
  function formatSpd(loc) {
    if (!loc) return null;
    const k = num(loc.speed_kmh), t = num(loc.speed_kt);
    const a = k != null ? fmtN(k) + " km/h" : null, b = t != null ? fmtN(t) + " kt" : null;
    return a && b ? a + " · " + b : a || b;
  }
  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function gcPoint(lat1, lon1, lat2, lon2, t) {
    const f = Math.max(0, Math.min(1, t));
    const p1 = rad(lat1), l1 = rad(lon1), p2 = rad(lat2), l2 = rad(lon2);
    const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2;
    const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (d === 0) return [lat1, lon1];
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    return [deg(Math.atan2(z, Math.sqrt(x * x + y * y))), deg(Math.atan2(y, x))];
  }
  function gcCourse(lat1, lon1, lat2, lon2) {
    const p1 = rad(lat1), p2 = rad(lat2), dl = rad(lon2 - lon1);
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }
  function planeMark(leg, now, st) {
    const depLat = num(leg.dep_lat), depLon = num(leg.dep_lon);
    const arrLat = num(leg.arr_lat), arrLon = num(leg.arr_lon);
    if ([depLat, depLon, arrLat, arrLon].some((x) => x == null)) return null;
    const loc = (leg.live || {}).location;
    const reported = loc && loc.reported_at ? Date.parse(loc.reported_at) : NaN;
    const fresh = Number.isFinite(reported) && now - reported <= 15 * MIN
      && num(loc.lat) != null && num(loc.lon) != null;
    const tms = times(leg);
    const depT = ms(tms.depActual || tms.depBest), arrT = ms(tms.arrBest);
    if (fresh) {
      return {
        lat: loc.lat, lon: loc.lon,
        track: num(loc.track_deg) ?? gcCourse(depLat, depLon, arrLat, arrLon),
        estimated: false, loc, depLat, depLon, arrLat, arrLon,
      };
    }
    if (!Number.isFinite(depT) || !Number.isFinite(arrT) || arrT <= depT) return null;
    if (!(st.inAir || (now >= depT && now < arrT))) return null;
    let f = (now - depT) / (arrT - depT);
    f = Math.max(0.02, Math.min(0.98, f));
    const [lat, lon] = gcPoint(depLat, depLon, arrLat, arrLon, f);
    const [aLat, aLon] = gcPoint(depLat, depLon, arrLat, arrLon, Math.min(1, f + 0.01));
    return {
      lat, lon, track: gcCourse(lat, lon, aLat, aLon),
      estimated: true, loc, depLat, depLon, arrLat, arrLon,
    };
  }
  function projecter(pts) {
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const [lat, lon] of pts) {
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    }
    if (maxLon - minLon > 150) return null;
    const latSpan = Math.max((maxLat - minLat) * 1.7, 6);
    const lonSpan = Math.max((maxLon - minLon) * 1.7, 12);
    const cLat = (minLat + maxLat) / 2, cLon = (minLon + maxLon) / 2;
    minLat = cLat - latSpan / 2; maxLat = cLat + latSpan / 2;
    minLon = cLon - lonSpan / 2; maxLon = cLon + lonSpan / 2;
    const W = 320, H = 140;
    return (lat, lon) => [
      (lon - minLon) / (maxLon - minLon) * W,
      (maxLat - lat) / (maxLat - minLat) * H,
    ];
  }
  function trackMap(leg, t, st) {
    const mark = planeMark(leg, Date.now(), st);
    if (!mark) return null;
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(gcPoint(mark.depLat, mark.depLon, mark.arrLat, mark.arrLon, i / 24));
    const proj = projecter([...pts, [mark.lat, mark.lon]]);
    if (!proj) return null;
    const d = pts.map((p, i) => {
      const [x, y] = proj(p[0], p[1]);
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
    const [px, py] = proj(mark.lat, mark.lon);
    const [ox, oy] = proj(mark.depLat, mark.depLon);
    const [dx, dy] = proj(mark.arrLat, mark.arrLon);
    const plane = svgEl("g", { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${mark.track.toFixed(1)})`, class: mark.estimated ? "est" : "live" },
      svgEl("path", { d: "M0,-8 L5,7 L0,4 L-5,7 Z" }));
    const svg = svgEl("svg", { viewBox: "0 0 320 140", class: "track-svg", "aria-hidden": "true" },
      svgEl("path", { d, class: "arc" }),
      svgEl("circle", { cx: ox.toFixed(1), cy: oy.toFixed(1), r: 3.5, class: "apt" }),
      svgEl("circle", { cx: dx.toFixed(1), cy: dy.toFixed(1), r: 3.5, class: "apt" }),
      plane);
    const facts = [];
    if (!mark.estimated) {
      const alt = formatAlt(mark.loc), spd = formatSpd(mark.loc);
      if (alt) facts.push(alt);
      if (spd) facts.push(spd);
      if (mark.loc && mark.loc.reported_at) {
        const agoMin = Math.round((Date.now() - Date.parse(mark.loc.reported_at)) / MIN);
        facts.push(agoMin < 1 ? "Updated just now" : "Updated " + agoMin + " min ago");
      }
    } else {
      facts.push("Estimated position");
    }
    facts.push("Approximate · not for navigation");
    return h("div", { class: "track-map", "aria-label": "Flight path" },
      svg, h("p", { class: "track-cap" }, facts.join(" · ")));
  }


  function endBlock(iata, best, sched, tz, label) {
    const diff = (ms(best) - ms(sched)) / MIN;
    const changed = Math.abs(diff) >= 5;
    return h("div", { class: "end" },
      h("div", { class: "iata" }, iata),
      h("div", { class: "time" + (diff >= 15 ? " late" : diff <= -5 ? " early" : "") }, fmtTime(best, tz)),
      h("div", { class: "sched" }, changed ? [label + " ", h("s", {}, fmtTime(sched, tz))] : label + " " + fmtDay(sched, tz)));
  }

  function legCard(leg, i, n) {
    const t = times(leg), st = statusOf(leg, t), L = leg.live || {}, d = L.dep || {}, a = L.arr || {};
    const delayMin = Math.round((ms(t.arrBest) - ms(t.arrS)) / MIN);
    const depDelay = Math.round((ms(t.depBest) - ms(t.depS)) / MIN);
    const blockMin = (ms(t.arrBest) - ms(t.depBest)) / MIN;
    const facts = [];
    const fact = (k, v) => v && facts.push(h("span", {}, k + " ", h("b", {}, v)));
    fact("Terminal", d.terminal); fact("Gate", d.gate); fact("Check-in", d.check_in);
    fact("Arr. terminal", a.terminal); fact("Arr. gate", a.gate); fact("Belt", a.belt); fact("Aircraft", L.aircraft);

    const map = trackMap(leg, t, st);
    let progress = null;
    const now = Date.now(), dep0 = ms(t.depActual || t.depBest), arr0 = ms(t.arrBest);
    if (!map && (st.inAir || (now > dep0 && now < arr0 && leg.live)) && L.status !== "Arrived") {
      const p = Math.max(0.02, Math.min(0.98, (now - dep0) / (arr0 - dep0)));
      progress = h("div", { class: "progress" },
        h("div", { class: "bar", role: "progressbar", "aria-valuenow": Math.round(p * 100), "aria-valuemin": 0, "aria-valuemax": 100 },
          h("i", { width: p * 100 + "%" }), h("span", { left: p * 100 + "%" }, "✈")),
        h("div", { class: "row small muted" }, h("span", {}, dur((now - dep0) / MIN) + " flown"),
          h("span", {}, dur((arr0 - now) / MIN) + " to go")));
    }
    let delay = null;
    if (L.status !== "Canceled" && (depDelay >= 15 || delayMin >= 15)) {
      delay = h("div", { class: "delay" },
        depDelay >= 15 ? `Departure ${dur(depDelay)} late` : "",
        depDelay >= 15 && delayMin >= 15 ? " · " : "",
        delayMin >= 15 ? `arrival ${dur(delayMin)} late` : "");
    }
    return h("section", { class: "card", "aria-label": `Flight ${i + 1} of ${n}` },
      h("div", { class: "row" },
        h("div", {}, h("div", { class: "flight" }, leg.flight_no.replace(/^([A-Z0-9]{2})(\d)/, "$1 $2")),
          h("div", { class: "airline" }, [leg.airline, n > 1 ? `Flight ${i + 1} of ${n}` : null].filter(Boolean).join(" · "))),
        h("span", { class: "chip " + st.cls }, st.label)),
      h("div", { class: "route" },
        endBlock(leg.dep, t.depBest, t.depS, t.depTz, "Sched."),
        h("div", { class: "mid" }, h("div", { class: "plane" }, "✈"), dur(blockMin)),
        endBlock(leg.arr, t.arrBest, t.arrS, t.arrTz, "Sched.")),
      delay, facts.length ? h("div", { class: "facts" }, facts) : null,
      map, progress);
  }

  function layover(prev, next) {
    const a = times(prev), b = times(next);
    const m = (ms(b.depBest) - ms(a.arrBest)) / MIN;
    const cls = m < 0 ? "missed" : m < 45 ? "tight" : "";
    const where = prev.arr === next.dep ? `in ${prev.arr}` : `${prev.arr} → ${next.dep} (change airport)`;
    const text = m < 0 ? `Connection at risk: next flight leaves ${dur(m)} before arrival ${where}`
      : `${dur(m)} connection ${where}` + (m < 45 ? " – tight" : "");
    return h("div", { class: "layover " + cls, role: cls ? "alert" : null }, h("span", {}, cls ? "⚠" : "⏱"), h("span", {}, text));
  }

  function renderState(kind) {
    clearTimeout(timer);
    const S = {
      expired: ["⌛", "This trip link has expired", "Links stop working 12 hours after the last flight lands, and the trip data is deleted."],
      revoked: ["🔒", "This link was turned off", "The traveller stopped sharing this trip."],
      not_found: ["🔎", "Trip not found", "Check that you opened the complete link. It may also have expired and been deleted."],
      missing: ["🔗", "No trip link", "Open the link the traveller sent you; it ends with ?t= and a code."],
    }[kind] || ["⚠", "Something went wrong", "Please try again in a few minutes."];
    $("title").textContent = "Trip"; $("subtitle").textContent = ""; $("updated").textContent = "";
    document.title = S[1] + " · Nimbo";
    main.replaceChildren(h("div", { class: "card state" }, h("div", { class: "big", "aria-hidden": "true" }, S[0]),
      h("h2", {}, S[1]), h("p", { class: "muted" }, S[2])));
  }

  function render(data) {
    const legs = data.legs || [];
    const first = legs[0], last = legs[legs.length - 1];
    const who = data.display_name ? `${data.display_name}'s trip` : "Trip";
    $("title").textContent = `${who}: ${[first.dep, ...legs.map((l) => l.arr)].join(" → ")}`;
    document.title = `${who} · Nimbo`;
    $("subtitle").textContent = `${fmtDay(first.dep_utc, first.dep_tz)} · ${legs.length} flight${legs.length > 1 ? "s" : ""}`;
    const kids = [];
    legs.forEach((l, i) => { if (i) kids.push(layover(legs[i - 1], l)); kids.push(legCard(l, i, legs.length)); });
    const ERR = {
      quota: "Live updates are paused for now (data limit reached). Times shown may be out of date.",
      upstream: "The flight data service is not answering right now; retrying automatically.",
      config: "Live flight data is not available for this link right now.",
      not_found: "No live data found for this flight yet.",
    };
    const now = Date.now();
    const anySoon = legs.some((l) => now > ms(l.dep_utc) - 6 * 3600000);
    if (data.live_error && ERR[data.live_error]) kids.push(h("p", { class: "notice warn" }, "⚠ " + ERR[data.live_error]));
    if (legs.every((l) => !l.live))
      kids.push(h("p", { class: "notice" }, (anySoon ? "Waiting for live data." : "Live status appears from 6 hours before departure.") + " Times shown are scheduled, in each airport's local time."));
    else kids.push(h("p", { class: "notice" }, "Times are local to each airport."));
    main.replaceChildren(...kids);
    const fetched = legs.map((l) => ms(l.fetched_at)).filter((x) => !isNaN(x));
    $("updated").textContent = (fetched.length ? `Flight data updated ${ago(Math.max(...fetched))}` : "No live data yet")
      + ` · page checked ${fmtTime(new Date(lastOk).toISOString())}` + (data.expires_at ? ` · link valid until ${fmtDay(data.expires_at, last.arr_tz)} ${fmtTime(data.expires_at, last.arr_tz)}` : "");
  }

  async function load() {
    if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return renderState(token ? "not_found" : "missing");
    let delay = cfg.refreshSeconds * 1000;
    try {
      const r = await fetch(`${cfg.functionUrl}?t=${encodeURIComponent(token)}`, {
        headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
        credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 410 || r.status === 404) return renderState(data.state || "not_found");
      if (r.status === 429) delay = 120000;
      else if (!r.ok) throw new Error(r.status);
      else {
        lastData = data; lastOk = Date.now(); render(data);
        // Faster while a leg is close or in the air, slower otherwise (2–5 min).
        const now = Date.now();
        const inAir = data.legs.some((l) => statusOf(l, times(l)).inAir);
        const busy = data.legs.some((l) => { const t = times(l); return now > ms(t.depBest) - 3 * 3600000 && now < ms(t.arrBest) + 1800000; });
        delay = (inAir ? 120 : busy ? 180 : 300) * 1000;
      }
    } catch (e) {
      if (lastData) { render(lastData); $("updated").textContent += " · offline, retrying"; }
      else renderState("error");
      delay = 60000;
    }
    clearTimeout(timer);
    timer = setTimeout(load, delay);
  }
  // Viewer toggle 24h | AM/PM: updates the URL (no cookies/storage).
  const tg = $("hfmt");
  function syncToggle() {
    for (const b of tg.querySelectorAll("button")) b.setAttribute("aria-pressed", String((b.dataset.h === "12") === h12));
  }
  tg.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    h12 = b.dataset.h === "12";
    const u = new URL(location.href);
    if (h12) u.searchParams.set("h", "12"); else u.searchParams.delete("h");
    history.replaceState(null, "", u);
    syncToggle();
    if (lastData) render(lastData);
  });
  syncToggle();
  document.addEventListener("visibilitychange", () => { if (!document.hidden && lastOk && Date.now() - lastOk > 60000) load(); });
  load();
})();
