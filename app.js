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
  function fmtTime(iso, tz) {
    if (!iso) return "–";
    try { return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: tz || "UTC" }).format(new Date(iso)); }
    catch { return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso)) + " UTC"; }
  }
  function fmtDay(iso, tz) {
    try { return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: tz || "UTC" }).format(new Date(iso)); }
    catch { return ""; }
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

    let progress = null;
    const now = Date.now(), dep0 = ms(t.depActual || t.depBest), arr0 = ms(t.arrBest);
    if ((st.inAir || (now > dep0 && now < arr0 && leg.live)) && L.status !== "Arrived") {
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
      delay, facts.length ? h("div", { class: "facts" }, facts) : null, progress);
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
    document.title = S[1] + " · Flight Tracker";
    main.replaceChildren(h("div", { class: "card state" }, h("div", { class: "big", "aria-hidden": "true" }, S[0]),
      h("h2", {}, S[1]), h("p", { class: "muted" }, S[2])));
  }

  function render(data) {
    const legs = data.legs || [];
    const first = legs[0], last = legs[legs.length - 1];
    const who = data.display_name ? `${data.display_name}'s trip` : "Trip";
    $("title").textContent = `${who}: ${[first.dep, ...legs.map((l) => l.arr)].join(" → ")}`;
    document.title = `${who} · Flight Tracker`;
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
      + ` · page checked ${ago(lastOk)}` + (data.expires_at ? ` · link valid until ${fmtDay(data.expires_at, last.arr_tz)} ${fmtTime(data.expires_at, last.arr_tz)}` : "");
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
        const busy = data.legs.some((l) => { const t = times(l); return now > ms(t.depBest) - 3 * 3600000 && now < ms(t.arrBest) + 1800000; });
        delay = (busy ? 120 : 300) * 1000;
      }
    } catch (e) {
      if (lastData) { render(lastData); $("updated").textContent += " · offline, retrying"; }
      else renderState("error");
      delay = 60000;
    }
    clearTimeout(timer);
    timer = setTimeout(load, delay);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && lastOk && Date.now() - lastOk > 60000) load(); });
  load();
})();
