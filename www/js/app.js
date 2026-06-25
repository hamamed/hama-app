/* HAMA WC 2026 — Cordova app. Renders the same markup/classes as the website. */
(function () {
  const t = I18N.t;
  const app = () => document.getElementById("app");
  const LOCALE = { en: "en-GB", fr: "fr-FR", ar: "ar" };
  const APP_VERSION = "1.5.0"; // bump this when you build a new APK
  let countdownTimer = null, liveTimer = null;
  let appUpdate = { available: false, url: "https://koydam.com/download/hama.apk" };
  let isAdminUser = false;
  let communityNew = 0;
  let fixturesTodo = 0;
  let fixturesDay = null;   // remembered day filter (survives the live re-render)
  let groupsTab = "groups"; // Groups | Knockout sub-tab

  async function checkAdmin() {
    try { const r = await API.me(); isAdminUser = !!r.isAdmin; communityNew = r.communityNew || 0; fixturesTodo = r.fixturesTodo || 0; }
    catch (e) { isAdminUser = false; }
  }

  // Register for push notifications — only if the cordova-plugin-push is installed.
  // (No-op in the browser / until the plugin + Firebase config are added and a new APK is built.)
  function registerPush() {
    try {
      if (!window.PushNotification || !API.token()) return;
      const p = window.PushNotification.init({ android: {}, ios: {}, browser: {} });
      p.on("registration", function (data) {
        if (data && data.registrationId) API.pushRegister(data.registrationId, "android").catch(function () {});
      });
      p.on("notification", function () { /* foreground notification — could refresh badges */ });
      p.on("error", function () {});
    } catch (e) { /* ignore */ }
  }

  function openExternal(url) {
    if (window.cordova && window.cordova.InAppBrowser) window.cordova.InAppBrowser.open(url, "_system");
    else window.open(url, "_system");
  }
  async function checkUpdate() {
    try {
      const r = await API.appVersion();
      if (r && r.version && r.version !== APP_VERSION) {
        appUpdate = { available: true, url: r.url || appUpdate.url };
        injectUpdateButton();
      }
    } catch (e) { /* offline — ignore */ }
  }
  function injectUpdateButton() {
    const bar = document.querySelector(".wc-navbar .container");
    if (bar && appUpdate.available && !document.getElementById("updateBtn")) {
      const a = document.createElement("a");
      a.id = "updateBtn"; a.href = "#"; a.className = "btn btn-accent btn-sm ms-2";
      a.innerHTML = '<i class="fa-solid fa-circle-arrow-down me-1"></i>' + esc(t("app.update"));
      a.addEventListener("click", (e) => { e.preventDefault(); openExternal(appUpdate.url); });
      bar.appendChild(a);
    }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function applyDir() {
    document.documentElement.dir = I18N.isRTL() ? "rtl" : "ltr";
    document.documentElement.lang = I18N.lang();
  }
  function applyTheme() {
    let t = "light";
    try { t = localStorage.getItem("theme") || "light"; } catch (e) {}
    document.documentElement.setAttribute("data-bs-theme", t);
  }
  function toggleTheme() {
    const dark = document.documentElement.getAttribute("data-bs-theme") === "dark";
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-bs-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  }
  function toast(msg, ok) {
    let box = document.getElementById("toastBox");
    if (!box) { box = document.createElement("div"); box.id = "toastBox"; box.className = "toast-box"; document.body.appendChild(box); }
    const el = document.createElement("div");
    el.className = "toast-msg " + (ok ? "toast-ok" : "toast-err");
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 2200);
  }
  function clearTimers() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  }
  const loc = () => LOCALE[I18N.lang()] || "en-GB";
  function fmtTime(ms) {
    return new Date(ms).toLocaleString(loc(), {
      timeZone: "Etc/GMT-1", weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  }
  function dayKey(ms) { return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Etc/GMT-1" }); }
  function dayLabel(key) {
    const now = Date.now(), D = 86400000;
    if (key === dayKey(now)) return t("day.today");
    if (key === dayKey(now - D)) return t("day.yesterday");
    if (key === dayKey(now + D)) return t("day.tomorrow");
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(loc(), { weekday: "short", month: "short", day: "numeric" });
  }

  // ---------- shell (navbar like the website + bottom nav) ----------
  function shell(activeTab, bodyHtml) {
    const u = API.user() || {};
    const langItems = I18N.LANGS.map((l) =>
      '<li><a class="dropdown-item ' + (l.c === I18N.lang() ? "active" : "") + '" href="#" data-l="' + l.c + '">' + esc(l.n) + "</a></li>").join("");
    const tabs = [
      { id: "fixtures", icon: "fa-calendar-days", label: t("nav.fixtures") },
      { id: "groups", icon: "fa-table-cells-large", label: t("nav.groups") },
      { id: "ranks", icon: "fa-trophy", label: t("nav.ranks") },
      { id: "community", icon: "fa-comments", label: t("comm2.nav") },
      { id: "profile", icon: "fa-user", label: t("nav.profile") },
    ];
    app().innerHTML =
      '<nav class="navbar wc-navbar"><div class="container">' +
        '<a class="navbar-brand d-flex align-items-center" href="#"><img class="brand-logo" src="img/logo.png" onerror="this.style.display=\'none\'"/></a>' +
        '<div class="dropdown ms-auto"><a class="nav-link dropdown-toggle lang-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">' +
          '<i class="fa-solid fa-globe me-1"></i>' + I18N.lang().toUpperCase() + "</a>" +
          '<ul class="dropdown-menu dropdown-menu-end">' + langItems + "</ul></div>" +
        '<span class="badge wc-userchip ms-2"><i class="fa-solid fa-user me-1"></i>' + esc(u.username || "") + "</span>" +
        (isAdminUser ? '<button id="adminBtn" class="btn btn-outline-secondary btn-sm ms-2" title="Admin"><i class="fa-solid fa-screwdriver-wrench"></i></button>' : "") +
        (appUpdate.available ? '<a id="updateBtn" href="#" class="btn btn-accent btn-sm ms-2"><i class="fa-solid fa-circle-arrow-down me-1"></i>' + esc(t("app.update")) + "</a>" : "") +
      "</div></nav>" +
      '<div class="container py-4" id="screen">' + bodyHtml + "</div>" +
      '<nav class="bottom-nav">' + tabs.map((x) =>
        '<button class="bottom-nav-item position-relative ' + (x.id === activeTab ? "active" : "") + '" data-tab="' + x.id + '">' +
        '<i class="fa-solid ' + x.icon + '"></i><span>' + esc(x.label) + "</span>" +
        (x.id === "community" && communityNew > 0 ? '<span class="badge rounded-pill text-bg-danger nav-badge">' + (communityNew > 99 ? "99+" : communityNew) + "</span>" : "") +
        (x.id === "fixtures" && fixturesTodo > 0 ? '<span class="badge rounded-pill text-bg-warning nav-badge">' + (fixturesTodo > 99 ? "99+" : fixturesTodo) + "</span>" : "") +
        "</button>").join("") + "</nav>";

    app().querySelectorAll(".bottom-nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    app().querySelectorAll("[data-l]").forEach((b) =>
      b.addEventListener("click", (e) => { e.preventDefault(); I18N.setLang(b.dataset.l); applyDir(); go(activeTab); }));
    const ub = document.getElementById("updateBtn");
    if (ub) ub.addEventListener("click", (e) => { e.preventDefault(); openExternal(appUpdate.url); });
    const ab = document.getElementById("adminBtn");
    if (ab) ab.addEventListener("click", () => go("admin"));
  }
  function setNavBadge(tab, n, cls) {
    const btn = document.querySelector('.bottom-nav-item[data-tab="' + tab + '"]');
    if (!btn) return;
    let b = btn.querySelector(".nav-badge");
    if (n > 0) {
      if (!b) { b = document.createElement("span"); btn.appendChild(b); }
      b.className = "badge rounded-pill " + cls + " nav-badge";
      b.textContent = n > 99 ? "99+" : n;
    } else if (b) { b.remove(); }
  }
  function refreshNavBadges() {
    setNavBadge("fixtures", fixturesTodo, "text-bg-warning");
    setNavBadge("community", communityNew, "text-bg-danger");
  }
  function setBody(html) { const s = document.getElementById("screen"); if (s) s.innerHTML = html; }
  function loading() { return '<div class="text-center text-secondary py-5"><i class="fa-solid fa-futbol fa-spin fa-2x"></i></div>'; }
  function applyPrivacy() {
    const hidden = localStorage.getItem("predsHidden") === "1";
    document.body.classList.toggle("preds-hidden", hidden);
    const btn = document.getElementById("privacyToggle");
    if (btn) btn.querySelector("i").className = hidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  }
  function fail() { setBody('<div class="text-center text-secondary py-5"><i class="fa-solid fa-triangle-exclamation fa-2x mb-2 d-block"></i>' + esc(t("netErr")) + "</div>"); }

  let currentTab = "fixtures";
  function go(tab) {
    clearTimers();
    currentTab = tab;
    const map = { fixtures: renderFixtures, groups: renderGroups, ranks: renderRanks, community: renderCommunity, profile: renderProfile, admin: renderAdmin };
    shell(tab, loading());
    (map[tab] || renderFixtures)();
  }

  // ---------- LOGIN ----------
  function renderLogin() {
    clearTimers(); applyDir();
    app().innerHTML =
      '<div class="login-hero d-flex align-items-center"><div class="container"><div class="row justify-content-center"><div class="col-12 col-md-7 col-lg-5">' +
        '<div class="langrow mb-3">' + I18N.LANGS.map((l) =>
          '<button class="btn btn-sm ' + (l.c === I18N.lang() ? "btn-accent" : "btn-outline-secondary") + '" data-l="' + l.c + '">' + l.c.toUpperCase() + "</button>").join("") + "</div>" +
        '<div class="text-center mb-4"><img class="login-logo-img mb-3" src="img/logo.png" onerror="this.style.display=\'none\'"/>' +
          '<p class="text-secondary mb-0">' + esc(t("login.tagline")) + "</p></div>" +
        '<div class="card wc-card border-0 shadow-lg"><div class="card-body p-4 p-md-5">' +
          '<h5 class="fw-semibold mb-3"><i class="fa-solid fa-user-astronaut text-accent me-2"></i>' + esc(t("login.enter")) + "</h5>" +
          '<form id="lf"><div class="input-group input-group-lg mb-3"><span class="input-group-text"><i class="fa-solid fa-at"></i></span>' +
          '<input id="u" type="text" class="form-control" placeholder="' + esc(t("login.placeholder")) + '" autocomplete="off"/></div>' +
          '<button class="btn btn-accent btn-lg w-100 fw-semibold">' + esc(t("login.play")) + ' <i class="fa-solid fa-arrow-right-long ms-1"></i></button></form>' +
        "</div></div>" +
        '<p class="text-center text-secondary small mt-4 mb-0">' + esc(t("login.hint")) + "</p>" +
      "</div></div></div></div>";

    app().querySelectorAll("[data-l]").forEach((b) => b.addEventListener("click", () => { I18N.setLang(b.dataset.l); renderLogin(); }));
    const input = document.getElementById("u");
    document.getElementById("lf").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = (input.value || "").trim();
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(name)) return toast(t("login.invalid"), false);
      try {
        const r = await API.login(name);
        if (r.needPin) return renderPin(name, r.mode);
        API.setSession(r.token, r.user); await checkAdmin(); go("fixtures");
      } catch (err) { toast(err.status === 400 ? t("login.invalid") : t("netErr"), false); }
    });
  }

  // ---------- PIN screen ----------
  function renderPin(username, mode) {
    clearTimers(); applyDir();
    const setMode = mode === "create" || mode === "set";
    app().innerHTML =
      '<div class="login-hero d-flex align-items-center"><div class="container"><div class="row justify-content-center"><div class="col-12 col-md-7 col-lg-5">' +
        '<div class="text-center mb-4"><img class="login-logo-img mb-3" src="img/logo.png" onerror="this.style.display=\'none\'"/>' +
          '<p class="text-secondary mb-0"><i class="fa-solid fa-user me-1"></i><span class="fw-bold">' + esc(username) + "</span></p></div>" +
        '<div class="card wc-card border-0 shadow-lg"><div class="card-body p-4 p-md-5">' +
          '<h5 class="fw-semibold mb-2 text-center"><i class="fa-solid fa-lock text-accent me-2"></i>' + esc(setMode ? t("pin.choose") : t("pin.enter")) + "</h5>" +
          (setMode ? '<p class="text-secondary small mb-4 text-center">' + esc(t("pin.hint")) + "</p>" : "") +
          '<form id="pf"><input id="pin" type="password" class="form-control pin-input mb-3" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" autofocus/>' +
          '<button class="btn btn-accent btn-lg w-100 fw-semibold">' + esc(t("pin.submit")) + ' <i class="fa-solid fa-arrow-right-long ms-1"></i></button></form>' +
          '<p class="text-center mt-3 mb-0"><a href="#" id="pback" class="text-secondary small">&larr; ' + esc(t("pin.back")) + "</a></p>" +
        "</div></div>" +
      "</div></div></div></div>";

    const pin = document.getElementById("pin");
    pin.addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 4); });
    document.getElementById("pback").addEventListener("click", (e) => { e.preventDefault(); renderLogin(); });
    document.getElementById("pf").addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = (pin.value || "").trim();
      if (!/^\d{4}$/.test(code)) return toast(t("pin.invalid"), false);
      try {
        const r = await API.login(username, code);
        if (r.token) { API.setSession(r.token, r.user); await checkAdmin(); go("fixtures"); }
      } catch (err) {
        toast(err.status === 401 ? t("pin.wrong") : err.status === 400 ? t("pin.invalid") : t("netErr"), false);
      }
    });
  }

  // ---------- FIXTURES ----------
  async function renderFixtures() {
    let data;
    try { data = await API.matches(); } catch { return fail(); }
    const matches = data.matches || [];

    const head = '<div class="d-flex justify-content-between align-items-start mb-4 gap-2">' +
      '<div><h2 class="fw-bold mb-0"><i class="fa-solid fa-calendar-days text-accent me-2"></i>' + esc(t("nav.fixtures")) + "</h2>" +
      '<p class="text-secondary mb-0">' + esc(t("dash.sub")) + "</p></div>" +
      '<button id="privacyToggle" type="button" class="btn btn-outline-secondary btn-sm" title="' + esc(t("dash.privacy")) + '"><i class="fa-solid fa-eye"></i></button></div>';

    if (!matches.length) {
      setBody(head + '<div id="community"></div><div class="text-center text-secondary py-5"><i class="fa-solid fa-futbol fa-2x mb-3 d-block"></i>' + esc(t("noFixtures")) + "</div>");
      loadCommunity();
      return;
    }

    const counts = {};
    matches.forEach((m) => { m._day = dayKey(m.kickoff); counts[m._day] = (counts[m._day] || 0) + 1; });
    const days = Object.keys(counts).sort();
    const today = dayKey(Date.now());
    let sel = (fixturesDay && (fixturesDay === "all" || counts[fixturesDay])) ? fixturesDay : (counts[today] ? today : "all");

    const chip = (key, label, n) => '<button class="day-chip" data-day="' + key + '"><span class="day-chip-main">' + esc(label) +
      '</span><span class="day-chip-sub">' + n + " " + esc(n > 1 ? t("day.matches") : t("day.match")) + "</span></button>";
    const daysHtml = '<div class="day-filter mb-4" id="days">' + chip("all", t("day.all"), matches.length) +
      days.map((k) => chip(k, dayLabel(k), counts[k])).join("") + "</div>";

    setBody(head + '<div id="community"></div>' + daysHtml + '<div class="row g-3" id="list"></div>' + howHtml());
    loadCommunity();

    const list = document.getElementById("list");
    function centerActive(smooth) {
      const a = document.querySelector("#days .day-chip.active");
      if (a) a.scrollIntoView({ inline: "center", block: "nearest", behavior: smooth ? "smooth" : "auto" });
    }
    function paint() {
      const vis = matches.filter((m) => sel === "all" || m._day === sel);
      list.innerHTML = vis.map(matchCard).join("") || '<div class="text-center text-secondary py-5">' + esc(t("noFixtures")) + "</div>";
      bindCards();
      document.querySelectorAll("#days .day-chip").forEach((c) => c.classList.toggle("active", c.dataset.day === sel));
    }
    document.querySelectorAll("#days .day-chip").forEach((c) =>
      c.addEventListener("click", () => { sel = c.dataset.day; fixturesDay = sel; paint(); centerActive(true); }));
    paint();
    requestAnimationFrame(() => centerActive(false));

    const pt = document.getElementById("privacyToggle");
    if (pt) pt.addEventListener("click", function () {
      const h = localStorage.getItem("predsHidden") === "1";
      localStorage.setItem("predsHidden", h ? "0" : "1");
      applyPrivacy();
    });
    applyPrivacy();

    if (matches.some((m) => m.badge === "live")) {
      liveTimer = setInterval(() => { if (document.getElementById("days")) renderFixtures(); }, 45000);
    }
  }

  // ---------- COMMUNITY (announcements + polls) ----------
  async function loadCommunity() {
    const wrap = document.getElementById("community");
    if (!wrap) return;
    let data;
    try { data = await API.community(); } catch { return; }
    wrap.innerHTML = communityHtml(data);
    bindCommunity(wrap, data);
  }

  function communityHtml(data) {
    let html = "";
    (data.announcements || [])
      .filter((a) => localStorage.getItem("annDismissed_" + a.id) !== "1")
      .forEach((a) => {
        html += '<div class="ann-banner d-flex align-items-start gap-2 mb-2" dir="auto">' +
          '<i class="fa-solid fa-bullhorn mt-1"></i>' +
          '<div class="flex-grow-1 pre-line">' + esc(a.message) + "</div>" +
          '<button type="button" class="btn-close ann-dismiss" data-id="' + a.id + '" aria-label="Close"></button></div>';
      });
    const polls = data.polls || [];
    if (polls.length) {
      html += '<div class="wc-card p-3 mb-3"><h6 class="fw-bold mb-3"><i class="fa-solid fa-square-poll-vertical text-accent me-2"></i>' + esc(t("comm.polls")) + "</h6>";
      polls.forEach((p, i) => { html += pollHtml(p, i === polls.length - 1); });
      html += "</div>";
    }
    return html;
  }

  function pollHtml(p, last) {
    let h = '<div class="' + (last ? "" : "mb-4") + '" data-poll="' + p.id + '">' +
      '<div class="fw-semibold mb-2 pre-line" dir="auto">' + esc(p.question) + "</div>";
    if (p.myVote === null) {
      h += '<div class="d-flex gap-2 poll-vote">' +
        '<button type="button" class="btn btn-accent btn-sm fw-semibold" data-choice="yes"><i class="fa-solid fa-check me-1"></i>' + esc(t("comm.yes")) + "</button>" +
        '<button type="button" class="btn btn-outline-secondary btn-sm fw-semibold" data-choice="no"><i class="fa-solid fa-xmark me-1"></i>' + esc(t("comm.no")) + "</button></div>";
    } else {
      h += pollResults(p);
    }
    return h + "</div>";
  }

  function pollResults(p) {
    const total = p.yes + p.no;
    const yp = total ? Math.round((p.yes / total) * 100) : 0;
    const np = total ? 100 - yp : 0;
    return '<div class="small">' +
      '<div class="d-flex justify-content-between"><span>' + esc(t("comm.yes")) + " · " + p.yes + "</span><span>" + yp + "%</span></div>" +
      '<div class="progress mb-2" style="height:8px;"><div class="progress-bar bg-success" style="width:' + yp + '%"></div></div>' +
      '<div class="d-flex justify-content-between"><span>' + esc(t("comm.no")) + " · " + p.no + "</span><span>" + np + "%</span></div>" +
      '<div class="progress mb-1" style="height:8px;"><div class="progress-bar bg-secondary" style="width:' + np + '%"></div></div>' +
      '<div class="d-flex justify-content-between align-items-center text-secondary mt-1">' +
        "<span>" + esc(t("comm.youVoted")) + " <strong>" + esc(p.myVote ? t("comm.yes") : t("comm.no")) + "</strong></span>" +
        "<span>" + total + " " + esc(t("comm.votes")) + "</span></div>" +
      '<button type="button" class="btn btn-link btn-sm p-0 mt-1 text-decoration-none poll-change"><i class="fa-solid fa-pen me-1"></i>' + esc(t("comm.changeVote")) + "</button></div>";
  }

  function bindCommunity(wrap, data) {
    wrap.querySelectorAll(".ann-dismiss").forEach((b) =>
      b.addEventListener("click", () => {
        localStorage.setItem("annDismissed_" + b.dataset.id, "1");
        const banner = b.closest(".ann-banner");
        if (banner) banner.remove();
      }));

    wrap.querySelectorAll("[data-poll]").forEach((node) => {
      const id = node.getAttribute("data-poll");
      node.addEventListener("click", async (e) => {
        const voteBtn = e.target.closest("[data-choice]");
        if (voteBtn) {
          try { await API.vote(id, voteBtn.dataset.choice); } catch (_) { return; }
          await loadCommunity();
          return;
        }
        const change = e.target.closest(".poll-change");
        if (change && !node.querySelector(".poll-vote")) {
          const p = (data.polls || []).find((x) => x.id === id) || {};
          change.insertAdjacentHTML("afterend",
            '<div class="d-flex gap-2 poll-vote mt-2">' +
            '<button type="button" class="btn btn-sm fw-semibold ' + (p.myVote ? "btn-accent" : "btn-outline-secondary") + '" data-choice="yes"><i class="fa-solid fa-check me-1"></i>' + esc(t("comm.yes")) + "</button>" +
            '<button type="button" class="btn btn-sm fw-semibold ' + (!p.myVote ? "btn-accent" : "btn-outline-secondary") + '" data-choice="no"><i class="fa-solid fa-xmark me-1"></i>' + esc(t("comm.no")) + "</button></div>");
          change.style.display = "none";
        }
      });
    });
  }

  // Mirror of the server scoring rules, for provisional live points.
  function computePts(pa, pb, aa, ab) {
    pa = +pa; pb = +pb; aa = +aa; ab = +ab;
    if (pa === aa && pb === ab) return 4;
    const so = (x, y) => (x > y ? 1 : x < y ? -1 : 0);
    if (so(pa, pb) !== so(aa, ab)) return 0;
    if (pa - pb === aa - ab) return 2;
    return 1;
  }

  function badgeHtml(b, pts, liveStatus) {
    if (b === "completed") return '<span class="badge wc-badge badge-done"><i class="fa-solid fa-flag-checkered me-1"></i>' + esc(t("legend.completed")) + (pts != null ? " (+" + pts + ")" : "") + "</span>";
    if (b === "live") return '<span class="badge wc-badge badge-live"><span class="live-dot"></span>' + esc(t("badge.live")) + (liveStatus && liveStatus !== "LIVE" ? " · " + esc(liveStatus) : "") + "</span>";
    if (b === "locked") return '<span class="badge wc-badge badge-locked"><i class="fa-solid fa-lock me-1"></i>' + esc(t("legend.locked")) + "</span>";
    return '<span class="badge wc-badge badge-open"><i class="fa-solid fa-unlock me-1"></i>' + esc(t("badge.open")) + "</span>";
  }
  function teamCol(name, flag) {
    const f = flag ? '<img class="flag-img" src="' + esc(flag) + '"/>' : '<i class="fa-solid fa-shield-halved"></i>';
    return '<div class="team w-100"><div class="team-flag">' + f + '</div><div class="fw-semibold mt-1">' + esc(name) + "</div></div>";
  }
  function matchCard(m) {
    let mid;
    if (m.badge === "completed") mid = '<span class="final-score">' + m.actualA + "&nbsp;-&nbsp;" + m.actualB + "</span>";
    else if (m.badge === "live") mid = '<span class="live-score">' + (m.liveA != null ? m.liveA : 0) + "&nbsp;-&nbsp;" + (m.liveB != null ? m.liveB : 0) + "</span>";
    else mid = '<span class="text-secondary fw-bold">' + esc(t("vs")) + "</span>";

    let bottom;
    if (m.badge === "open") {
      bottom = '<form class="predict" data-id="' + m.id + '"><div class="d-flex align-items-center justify-content-center gap-2 mb-3">' +
        '<input type="number" name="a" min="0" max="99" class="form-control score-input text-center user-pred" value="' + (m.pred ? m.pred.a : "") + '" placeholder="0" required/>' +
        '<span class="fw-bold text-secondary">-</span>' +
        '<input type="number" name="b" min="0" max="99" class="form-control score-input text-center user-pred" value="' + (m.pred ? m.pred.b : "") + '" placeholder="0" required/></div>' +
        '<button class="btn btn-accent w-100 fw-semibold"><i class="fa-solid fa-floppy-disk me-1"></i>' + esc(m.pred ? t("update") : t("save")) + "</button></form>";
    } else {
      let pick = '<span class="text-secondary fst-italic"><i class="fa-solid fa-ban me-1"></i>' + esc(t("dash.noPrediction")) + "</span>";
      if (m.pred) {
        pick = '<span class="text-secondary">' + esc(t("yourPick")) + ":</span> <span class=\"fw-semibold user-pred\">" + m.pred.a + "-" + m.pred.b + "</span>";
        if (m.badge === "completed") {
          const p = m.pred.pts;
          const cls = p === 4 ? "badge-done" : p > 0 ? "badge-open" : "badge-locked";
          const ic = p === 4 ? "fa-bullseye" : p === 2 ? "fa-arrows-left-right" : p === 1 ? "fa-check" : "fa-xmark";
          const ex = p === 4 ? esc(t("dash.exactBonus")) + " " : "";
          pick += '<div class="mt-2"><span class="badge wc-badge ' + cls + '"><i class="fa-solid ' + ic + ' me-1"></i>' + ex + esc(t("dash.earned")) + " +" + p + " " + esc(t("pts")) + "</span></div>";
        } else if (m.badge === "live" && m.liveA != null && m.liveB != null) {
          const lp = computePts(m.pred.a, m.pred.b, m.liveA, m.liveB);
          pick += '<div class="mt-2"><span class="badge wc-badge badge-live"><span class="live-dot"></span> ' + esc(t("dash.earned")) + " +" + lp + " " + esc(t("pts")) + " · " + esc(t("badge.live")) + "</span></div>";
        }
      }
      bottom = '<div class="text-center small">' + pick + "</div>" +
        '<div class="mt-2 text-center"><button type="button" class="btn btn-link p-0 small text-accent text-decoration-none see-all" data-id="' + m.id + '">' +
        '<i class="fa-solid fa-people-group me-1"></i>' + esc(t("seeAll")) + "</button></div>";
    }

    return '<div class="col-12 col-md-6"><div class="card wc-card h-100 border-0 match-card match-' + m.badge + '"><div class="card-body d-flex flex-column">' +
      '<div class="d-flex justify-content-between align-items-center mb-3">' + badgeHtml(m.badge, m.badge === "completed" && m.pred ? m.pred.pts : null, m.liveStatus) +
        '<small class="text-secondary">' + esc(fmtTime(m.kickoff)) + "</small></div>" +
      '<div class="d-flex align-items-center justify-content-between text-center mb-3">' + teamCol(m.teamA, m.flagA) +
        '<div class="vs px-2">' + mid + "</div>" + teamCol(m.teamB, m.flagB) + "</div>" +
      '<div class="mt-auto">' + bottom + "</div>" +
    "</div></div></div>";
  }
  function bindCards() {
    document.querySelectorAll("form.predict").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        if (btn.disabled) return;
        const a = form.querySelector('[name="a"]').value, b = form.querySelector('[name="b"]').value;
        if (a === "" || b === "") return toast(t("invalid"), false);
        btn.disabled = true; const orig = btn.innerHTML;
        try {
          await API.predict(form.dataset.id, a, b);
          btn.innerHTML = '<i class="fa-solid fa-check me-1"></i>' + t("saved");
          btn.classList.add("btn-saved"); toast(t("saved"), true);
          API.me().then((r) => { fixturesTodo = r.fixturesTodo || 0; communityNew = r.communityNew || 0; refreshNavBadges(); }).catch(() => {});
          setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i>' + t("update"); btn.classList.remove("btn-saved"); btn.disabled = false; }, 1400);
        } catch (err) {
          toast(err.status === 403 ? t("locked") : err.status === 400 ? t("invalid") : t("netErr"), false);
          btn.innerHTML = orig; btn.disabled = false;
        }
      });
    });
    document.querySelectorAll(".see-all").forEach((b) => b.addEventListener("click", () => openPreds(b.dataset.id)));
  }
  function howHtml() {
    const items = [["fa-pen", "how.predict"], ["fa-lock", "how.lock"], ["fa-bullseye", "how.exact"],
      ["fa-arrows-left-right", "how.difference"], ["fa-check-double", "how.outcome"], ["fa-xmark", "how.wrong"], ["fa-crown", "how.champion"]];
    return '<div class="card wc-card border-0 mt-4 how-card"><div class="card-body"><h6 class="fw-bold mb-3"><i class="fa-solid fa-circle-info text-accent me-2"></i>' + esc(t("how.title")) + "</h6>" +
      '<div class="row g-2 small">' + items.map((it) => '<div class="col-12 col-md-6"><i class="fa-solid ' + it[0] + ' text-accent me-2"></i>' + esc(t(it[1])) + "</div>").join("") + "</div></div></div>";
  }

  // ---------- See-all modal ----------
  function openPreds(id) {
    let el = document.getElementById("predsModal");
    if (!el) {
      el = document.createElement("div");
      el.id = "predsModal"; el.className = "modal fade"; el.tabIndex = -1;
      el.innerHTML = '<div class="modal-dialog modal-dialog-scrollable modal-dialog-centered"><div class="modal-content wc-card border-0">' +
        '<div class="modal-header"><h5 class="modal-title fw-bold" id="pmTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" id="pmBody"></div></div></div>';
      document.body.appendChild(el);
    }
    const title = document.getElementById("pmTitle"), body = document.getElementById("pmBody");
    title.textContent = t("mp.title"); body.innerHTML = loading();
    bootstrap.Modal.getOrCreateInstance(el).show();
    API.matchPreds(id).then((j) => {
      title.textContent = t("mp.title") + " — " + j.teamA + " vs " + j.teamB;
      if (!j.preds.length) { body.innerHTML = '<div class="text-center text-secondary py-4">' + esc(t("mp.none")) + "</div>"; return; }
      const me = (API.user() || {}).username;

      // Group pts-sorted predictions into up to 3 distinct-points places; tied
      // players share a place and split it (50/50, 33/33/33, …).
      const buildPodium = (preds) => {
        const tiers = [];
        let idx = 0;
        // 1st place: everyone tied on the top score shares it.
        if (preds.length && preds[0].pts != null) {
          const topPts = preds[0].pts, members = [];
          while (idx < preds.length && preds[idx].pts === topPts) { members.push(preds[idx]); idx++; }
          tiers.push({ place: 1, pts: topPts, members: members });
        }
        // 2nd & 3rd: single next players (no sharing).
        for (let place = 2; place <= 3 && idx < preds.length && preds[idx].pts != null; place++, idx++) {
          tiers.push({ place: place, pts: preds[idx].pts, members: [preds[idx]] });
        }
        if (!tiers.length) return "";
        const renderPlace = (tier) => {
          if (!tier) return "";
          const cls = tier.place === 1 ? "gold" : tier.place === 2 ? "silver" : "bronze";
          const members = tier.members.map((p) => {
            const av = p.avatar
              ? '<img class="podium-avatar" src="' + esc(p.avatar) + '" alt=""/>'
              : '<span class="podium-avatar d-inline-flex align-items-center justify-content-center"><i class="fa-solid fa-user text-secondary"></i></span>';
            return '<div class="podium-member"><div class="podium-ava-wrap">' + av +
              '<span class="medal medal-' + cls + ' podium-medal">' + tier.place + '</span></div>' +
              '<div class="podium-name">' + esc(p.username) + "</div></div>";
          }).join("");
          return '<div class="podium-place podium-' + tier.place + '"><div class="podium-members">' + members + "</div>" +
            '<div class="podium-points">+' + tier.pts + " " + esc(t("pts")) + "</div>" +
            '<div class="podium-bar">' + tier.place + "</div></div>";
        };
        const byPlace = (n) => tiers.find((tt) => tt.place === n);
        return '<div class="podium mb-3">' + renderPlace(byPlace(2)) + renderPlace(byPlace(1)) + renderPlace(byPlace(3)) + "</div>";
      };
      const liveTag = j.live ? '<div class="text-center small text-danger fw-bold mb-2"><span class="live-dot"></span> ' + esc(t("badge.live")) + (j.liveStatus && j.liveStatus !== "LIVE" ? " · " + esc(j.liveStatus) : "") + "</div>" : "";
      const podium = j.scored ? buildPodium(j.preds) : "";

      let h = liveTag + podium + '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th style="width:42px">#</th><th>' + esc(t("lb.player")) +
        '</th><th class="text-center">' + esc(t("mp.pick")) + "</th>" + (j.scored ? '<th class="text-end">' + esc(t("lb.points")) + "</th>" : "") + "</tr></thead><tbody>";
      j.preds.forEach((p, i) => {
        let pts = "";
        if (j.scored) { const b = p.pts === 4 ? "badge-done" : p.pts > 0 ? "badge-open" : "badge-locked"; pts = '<td class="text-end"><span class="badge wc-badge ' + b + '">' + (p.pts > 0 ? "+" : "") + p.pts + "</span></td>"; }
        const mine = p.username === me;
        const av = p.avatar ? '<img src="' + esc(p.avatar) + '" class="avatar-mini me-2" alt=""/>' : "";
        h += '<tr class="' + (mine ? "row-me" : "") + '"><td class="text-secondary">' + (j.scored ? p.rank : i + 1) + '</td><td class="fw-semibold">' + av + esc(p.username) +
          (mine ? ' <span class="badge wc-userchip ms-1">' + esc(t("lb.you")) + "</span>" : "") + '</td><td class="text-center fw-bold">' + p.a + " - " + p.b + "</td>" + pts + "</tr>";
      });
      body.innerHTML = h + "</tbody></table></div>";
    }).catch(() => { body.innerHTML = '<div class="text-center text-danger py-4">' + esc(t("netErr")) + "</div>"; });
  }

  // ---------- Profile editors (flag picker + username) ----------
  function openFlagPicker(flags) {
    let el = document.getElementById("flagModal");
    if (!el) { el = document.createElement("div"); el.id = "flagModal"; el.className = "modal fade"; el.tabIndex = -1; document.body.appendChild(el); }
    el.innerHTML = '<div class="modal-dialog modal-dialog-scrollable modal-dialog-centered"><div class="modal-content wc-card border-0">' +
      '<div class="modal-header"><h5 class="modal-title fw-bold">' + esc(t("profile.chooseFlag")) + '</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body"><div class="row g-2">' +
        flags.map((f) => '<div class="col-3 col-md-2"><button type="button" class="flag-pick" data-code="' + esc(f.code) + '" title="' + esc(f.name) + '"><img src="' + esc(f.url) + '" alt="" onerror="this.closest(\'.flag-pick\').style.display=\'none\'"/></button></div>').join("") +
      "</div></div></div></div>";
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
    el.querySelectorAll(".flag-pick").forEach((b) => b.addEventListener("click", async function () {
      try { const r = await API.setAvatar(this.dataset.code); API.updateUser({ avatar: r.avatar }); modal.hide(); go("profile"); }
      catch (e) { toast(t("netErr"), false); }
    }));
  }
  function openNameEditor(name) {
    let el = document.getElementById("nameModal");
    if (!el) { el = document.createElement("div"); el.id = "nameModal"; el.className = "modal fade"; el.tabIndex = -1; document.body.appendChild(el); }
    el.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content wc-card border-0">' +
      '<div class="modal-header"><h5 class="modal-title fw-bold">' + esc(t("profile.changeName")) + '</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body"><div class="input-group input-group-lg"><span class="input-group-text"><i class="fa-solid fa-at"></i></span>' +
      '<input id="nameInput" class="form-control" maxlength="20" value="' + esc(name) + '"/></div></div>' +
      '<div class="modal-footer"><button id="nameSave" class="btn btn-accent w-100 fw-semibold">' + esc(t("profile.save")) + "</button></div></div></div>";
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
    el.querySelector("#nameSave").addEventListener("click", async function () {
      const v = (el.querySelector("#nameInput").value || "").trim();
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(v)) return toast(t("login.invalid"), false);
      try { const r = await API.setUsername(v); API.updateUser({ username: r.username }); modal.hide(); go("profile"); }
      catch (e) { toast(e.status === 409 ? t("profile.taken") : t("netErr"), false); }
    });
  }

  // ---------- GROUPS ----------
  function bracketHtml(b) {
    const cols = b && b.columns;
    if (!cols || !cols.some((c) => c.matches.length)) {
      return '<div class="card wc-card border-0"><div class="card-body text-center text-secondary py-5"><i class="fa-solid fa-sitemap fa-2x mb-3 d-block"></i>' + esc(t("ko.empty")) + "</div></div>";
    }
    let h = b.provisional ? '<p class="text-secondary small mb-3"><i class="fa-solid fa-circle-info me-1"></i>' + esc(t("ko.provisional")) + "</p>" : "";
    h += '<div class="bracket">';
    cols.forEach((rd) => {
      h += '<div class="bracket-col"><div class="bracket-round">' + esc(rd.title) + "</div>";
      rd.matches.forEach((m) => {
        const fa = m.flagA ? '<img src="' + esc(m.flagA) + '" class="flag-mini me-1"/>' : "";
        const fb = m.flagB ? '<img src="' + esc(m.flagB) + '" class="flag-mini me-1"/>' : "";
        h += '<div class="bracket-match"><div class="bm-team"><span>' + fa + esc(m.teamA || m.labelA || "—") + "</span>" + (m.scoreA != null ? "<b>" + m.scoreA + "</b>" : "") + "</div>" +
          '<div class="bm-team"><span>' + fb + esc(m.teamB || m.labelB || "—") + "</span>" + (m.scoreB != null ? "<b>" + m.scoreB + "</b>" : "") + "</div></div>";
      });
      h += "</div>";
    });
    return h + "</div>";
  }

  async function renderGroups() {
    const head = '<div class="mb-3"><h2 class="fw-bold mb-0"><i class="fa-solid fa-table-cells-large text-accent me-2"></i>' + esc(t("st.title")) + "</h2></div>" +
      '<div class="btn-group btn-group-sm mb-3"><button class="btn ' + (groupsTab === "groups" ? "btn-accent" : "btn-outline-secondary") + ' gt-g"><i class="fa-solid fa-layer-group me-1"></i>' + esc(t("ko.groups")) + "</button>" +
      '<button class="btn ' + (groupsTab === "knockout" ? "btn-accent" : "btn-outline-secondary") + ' gt-k"><i class="fa-solid fa-sitemap me-1"></i>' + esc(t("ko.tab")) + "</button></div>";
    const bindToggle = () => {
      const g = document.querySelector(".gt-g"), k = document.querySelector(".gt-k");
      if (g) g.addEventListener("click", () => { groupsTab = "groups"; renderGroups(); });
      if (k) k.addEventListener("click", () => { groupsTab = "knockout"; renderGroups(); });
    };

    if (groupsTab === "knockout") {
      setBody(head + '<div id="koWrap">' + loading() + "</div>");
      bindToggle();
      let b; try { b = await API.knockout(); } catch { b = null; }
      const w = document.getElementById("koWrap");
      if (w) w.innerHTML = b ? bracketHtml(b) : '<div class="text-center text-danger py-4">' + esc(t("netErr")) + "</div>";
      return;
    }

    let data; try { data = await API.standings(); } catch { return fail(); }
    const groups = (data.groups || []).filter((g) => g.rows.length);
    if (!groups.length) { setBody(head + '<div class="card wc-card border-0"><div class="card-body text-center text-secondary py-5"><i class="fa-solid fa-table-list fa-2x mb-3 d-block"></i>' + esc(t("st.none")) + "</div></div>"); bindToggle(); return; }

    const thead = "<tr><th>#</th><th>" + esc(t("st.team")) + '</th><th class="text-center">' + esc(t("st.p")) + '</th><th class="text-center">' + esc(t("st.w")) +
      '</th><th class="text-center">' + esc(t("st.d")) + '</th><th class="text-center">' + esc(t("st.l")) + '</th><th class="text-center">' + esc(t("st.gd")) + '</th><th class="text-center">' + esc(t("st.pts")) + "</th></tr>";
    function row(r, top) {
      const cls = top && r.rank <= 2 ? "qualify" : top && r.rank === 3 ? "playoff" : "";
      const flag = r.flag ? '<img class="flag-mini" src="' + esc(r.flag) + '"/>' : "";
      return '<tr class="' + cls + '"><td><b>' + r.rank + "</b></td><td>" + flag + esc(r.team) + "</td>" +
        '<td class="text-center">' + r.played + '</td><td class="text-center">' + r.win + '</td><td class="text-center">' + r.draw +
        '</td><td class="text-center">' + r.lose + '</td><td class="text-center">' + (r.gd > 0 ? "+" + r.gd : r.gd) + '</td><td class="text-center fw-bold text-accent">' + r.points + "</td></tr>";
    }
    let html = head + '<div class="row g-3">';
    groups.forEach((g) => {
      html += '<div class="col-12 col-lg-6"><div class="card wc-card border-0 h-100"><div class="card-body"><h6 class="fw-bold mb-3"><i class="fa-solid fa-layer-group text-accent me-2"></i>' + esc(g.name) +
        '</h6><div class="table-responsive"><table class="table table-hover align-middle mb-0 standings-table"><thead>' + thead + "</thead><tbody>" +
        g.rows.map((r) => row(r, true)).join("") + "</tbody></table></div></div></div></div>";
    });
    html += "</div>";
    if (data.thirds && data.thirds.length) {
      html += '<div class="card wc-card border-0 mt-4"><div class="card-body"><h6 class="fw-bold mb-3"><i class="fa-solid fa-ranking-star text-accent me-2"></i>' + esc(t("st.bestThirds")) +
        '</h6><div class="table-responsive"><table class="table table-hover align-middle mb-0 standings-table"><thead>' + thead + "</thead><tbody>" +
        data.thirds.map((r) => row({ ...r, rank: r.thirdRank }, false)).join("") + "</tbody></table></div></div></div>";
    }
    setBody(html);
    bindToggle();
  }

  // ---------- RANKS ----------
  async function renderRanks() {
    let data; try { data = await API.leaderboard(); } catch { return fail(); }
    const users = data.users || [];
    const head = '<div class="mb-4"><h2 class="fw-bold mb-0"><i class="fa-solid fa-trophy text-accent me-2"></i>' + esc(t("lb.title")) + "</h2></div>";
    if (!users.length) return setBody(head + '<div class="text-center text-secondary py-5">' + esc(t("lb.empty")) + "</div>");
    const me = (API.user() || {}).username;

    // Top-3 podium (2nd · 1st · 3rd)
    const podPlace = (u, rank) => {
      if (!u) return "";
      const cls = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
      const ava = u.avatar
        ? '<img class="podium-avatar" src="' + esc(u.avatar) + '" alt=""/>'
        : '<span class="podium-avatar d-inline-flex align-items-center justify-content-center"><i class="fa-solid fa-user text-secondary"></i></span>';
      const liveTag = u.livePts > 0 ? ' <span class="text-danger"><span class="live-dot"></span>+' + u.livePts + "</span>" : "";
      return '<div class="podium-place podium-' + rank + '" data-id="' + esc(u.id) + '">' +
        '<div class="podium-ava-wrap">' + ava + '<span class="medal medal-' + cls + ' podium-medal">' + rank + "</span></div>" +
        '<div class="podium-name">' + esc(u.username) + "</div>" +
        '<div class="podium-points">' + u.totalPoints + " " + esc(t("pts")) + liveTag + "</div>" +
        '<div class="podium-bar">' + rank + "</div></div>";
    };
    const pIcons = ["fa-trophy", "fa-medal", "fa-award", "fa-crown", "fa-star", "fa-ranking-star", "fa-futbol", "fa-stopwatch"];
    let podPattern = '<div class="podium-pattern" aria-hidden="true">';
    for (let i = 0; i < 140; i++) podPattern += '<i class="fa-solid ' + pIcons[i % pIcons.length] + '"></i>';
    podPattern += "</div>";
    const podium = '<div class="card wc-card border-0 mb-4 podium-card">' + podPattern + '<div class="card-body"><div class="podium mb-0">' +
      podPlace(users[1], 2) + podPlace(users[0], 1) + podPlace(users[2], 3) + "</div></div></div>";

    let html = head + podium + '<div class="card wc-card border-0"><div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
      '<thead><tr><th class="ps-4" style="width:70px">' + esc(t("lb.rank")) + '</th><th style="width:54px" class="text-center"><i class="fa-solid fa-arrows-up-down"></i></th><th>' +
      esc(t("lb.player")) + '</th><th class="text-end pe-4">' + esc(t("lb.points")) + "</th></tr></thead><tbody>";
    users.forEach((u) => {
      const medal = u.rank === 1 ? '<span class="medal medal-gold">1</span>' : u.rank === 2 ? '<span class="medal medal-silver">2</span>' :
        u.rank === 3 ? '<span class="medal medal-bronze">3</span>' : '<span class="text-secondary">#' + u.rank + "</span>";
      const move = u.move > 0 ? '<span class="text-success"><i class="fa-solid fa-caret-up"></i> ' + u.move + "</span>" :
        u.move < 0 ? '<span class="text-danger"><i class="fa-solid fa-caret-down"></i> ' + -u.move + "</span>" :
        '<span class="text-secondary"><i class="fa-solid fa-minus"></i></span>';
      const av = u.avatar ? '<img src="' + esc(u.avatar) + '" class="avatar-mini me-2" alt=""/>' : '<i class="fa-solid fa-user-circle text-secondary me-2"></i>';
      const gained = u.livePts > 0 ? ' <small class="text-danger fw-bold"><span class="live-dot"></span>+' + u.livePts + "</small>" : u.gained > 0 ? ' <small class="text-success fw-bold">+' + u.gained + "</small>" : "";
      html += '<tr class="user-row ' + (u.me ? "row-me" : "") + '" data-id="' + u.id + '" style="cursor:pointer"><td class="ps-4">' + medal + '</td><td class="text-center small fw-bold">' + move +
        "</td><td>" + av + '<span class="fw-semibold">' + esc(u.username) + "</span>" +
        (u.me ? ' <span class="badge wc-userchip ms-2">' + esc(t("lb.you")) + "</span>" : "") + '</td><td class="text-end pe-4 fw-bold text-accent">' + u.totalPoints + gained + "</td></tr>";
    });
    html += "</tbody></table></div></div>";

    // Champion race widget
    const race = data.championRace;
    if (race && race.total > 0) {
      html += '<div class="card wc-card border-0 mt-4"><div class="card-body"><h6 class="fw-bold mb-3"><i class="fa-solid fa-crown text-accent me-2"></i>' + esc(t("champ.race")) + "</h6>" +
        race.rows.map((r) => {
          const pct = Math.round(r.n / race.total * 100);
          const flag = r.flag ? '<img src="' + esc(r.flag) + '" class="flag-mini me-1" alt=""/>' : "";
          return '<div class="mb-2"><div class="d-flex justify-content-between small mb-1"><span>' + flag + esc(r.team) + '</span><span class="text-secondary">' + r.n + " · " + pct + '%</span></div><div class="progress" style="height:8px;"><div class="progress-bar bg-accent" style="width:' + pct + '%"></div></div></div>';
        }).join("") + "</div></div>";
    }

    setBody(html);
    document.querySelectorAll(".user-row, .podium-place").forEach((r) =>
      r.addEventListener("click", () => openUserProfile(r.dataset.id)));

    // Auto-refresh while live points are in play.
    if (users.some((u) => u.livePts > 0)) {
      liveTimer = setInterval(() => { if (currentTab === "ranks") renderRanks(); }, 45000);
    }
  }

  function openUserProfile(id) {
    let el = document.getElementById("userModal");
    if (!el) {
      el = document.createElement("div");
      el.id = "userModal"; el.className = "modal fade"; el.tabIndex = -1;
      el.innerHTML = '<div class="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered"><div class="modal-content wc-card border-0">' +
        '<div class="modal-header"><h5 class="modal-title fw-bold d-flex align-items-center gap-2" id="upTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" id="upBody"></div></div></div>';
      document.body.appendChild(el);
    }
    const title = document.getElementById("upTitle"), body = document.getElementById("upBody");
    title.textContent = "…"; body.innerHTML = loading();
    bootstrap.Modal.getOrCreateInstance(el).show();

    API.userProfile(id).then((d) => {
      const av = d.avatar ? '<img src="' + esc(d.avatar) + '" class="avatar-mini" alt=""/>' : '<i class="fa-solid fa-user-circle text-secondary"></i>';
      title.innerHTML = av + " " + esc(d.username);
      const s = d.stats;
      const tile = (label, value, cls) =>
        '<div class="col-6 col-md-3"><div class="stat-tile text-center p-2 rounded">' +
        '<div class="fw-bold fs-5 ' + (cls || "text-accent") + '">' + value + "</div>" +
        '<div class="small text-secondary">' + esc(label) + "</div></div></div>";
      let h = '<div class="row g-2 mb-3">' +
        tile(t("stat.totalPoints"), s.totalPoints, "text-accent") +
        tile(t("stat.exact"), s.exact, "text-success") +
        tile(t("stat.difference"), s.difference, "text-primary") +
        tile(t("stat.outcomes"), s.outcome, "text-info") +
        tile(t("stat.hitRate"), s.hitRate + "%", "text-accent") +
        tile(t("stat.made"), s.made) +
        tile(t("stat.scored2"), s.scored) +
        tile(t("stat.pending"), s.pending) +
        tile(t("stat.missed"), s.missed, "text-danger") +
        "</div>";
      if (d.achievements && d.achievements.length) {
        h += '<div class="d-flex flex-wrap gap-2 mb-3">' + d.achievements.map((a) => '<span class="ach-badge ' + (a.earned ? "earned" : "") + '"><i class="fa-solid ' + a.icon + ' me-1"></i>' + esc(t("ach." + a.key)) + "</span>").join("") + "</div>";
      }
      h += '<h6 class="fw-bold mb-2"><i class="fa-solid fa-clock-rotate-left text-accent me-2"></i>' + esc(t("hist.title")) + "</h6>";
      if (!d.history.length) {
        h += '<div class="text-center text-secondary py-3">' + esc(t("hist.none")) + "</div>";
      } else {
        h += '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>' +
          esc(t("hist.match")) + '</th><th class="text-center">' + esc(t("hist.yourPick")) + '</th><th class="text-center">' +
          esc(t("hist.result")) + '</th><th class="text-end">' + esc(t("hist.points")) + "</th></tr></thead><tbody>";
        h += d.history.map((x) => {
          let b;
          if (x.points === 4) b = '<span class="badge wc-badge badge-done">+4</span>';
          else if (x.points === 2) b = '<span class="badge wc-badge badge-open">+2</span>';
          else if (x.points === 1) b = '<span class="badge wc-badge badge-open">+1</span>';
          else if (x.points === 0) b = '<span class="badge wc-badge badge-locked">0</span>';
          else b = '<span class="text-secondary">—</span>';
          return "<tr><td>" + esc(x.teamA) + ' <span class="text-secondary">vs</span> ' + esc(x.teamB) +
            '</td><td class="text-center fw-semibold">' + esc(x.pred) + '</td><td class="text-center">' + esc(x.result || "—") +
            '</td><td class="text-end">' + b + "</td></tr>";
        }).join("");
        h += "</tbody></table></div>";
      }
      body.innerHTML = h;
    }).catch(() => { body.innerHTML = '<div class="text-center text-danger py-4">' + esc(t("netErr")) + "</div>"; });
  }

  // ---------- SHARE CARD ----------
  function buildShareCanvas(d) {
    const c = document.createElement("canvas"); c.width = 1000; c.height = 560;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 1000, 560); g.addColorStop(0, "#1f83ff"); g.addColorStop(1, "#0a6ae0");
    x.fillStyle = g; x.fillRect(0, 0, 1000, 560);
    x.fillStyle = "#fff"; x.textAlign = "center";
    x.font = "bold 42px Nunito, sans-serif"; x.fillText("HAMA · World Cup 2026", 500, 90);
    x.font = "bold 64px Nunito, sans-serif"; x.fillText(d.name || "", 500, 195);
    x.font = "900 150px Nunito, sans-serif"; x.fillText("#" + (d.rank || "?"), 500, 350);
    x.font = "bold 38px Nunito, sans-serif"; x.fillText((d.points || 0) + " pts  ·  " + (d.hit || 0) + "% hit rate", 500, 430);
    x.font = "26px Nunito, sans-serif"; x.globalAlpha = 0.85; x.fillText("koydam.com", 500, 510);
    return c;
  }
  function shareCard(d) {
    const canvas = buildShareCanvas(d);
    canvas.toBlob(function (blob) {
      const file = new File([blob], "hama-rank.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "My HAMA rank" }).catch(function () { showShareImg(canvas); });
      } else {
        showShareImg(canvas);
      }
    });
  }
  function showShareImg(canvas) {
    let el = document.getElementById("shareModal");
    if (!el) { el = document.createElement("div"); el.id = "shareModal"; el.className = "modal fade"; el.tabIndex = -1; document.body.appendChild(el); }
    el.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content wc-card border-0">' +
      '<div class="modal-body text-center"><img src="' + canvas.toDataURL("image/png") + '" class="img-fluid rounded mb-2" alt=""/>' +
      '<p class="small text-secondary mb-0">' + esc(t("profile.shareHint")) + "</p></div></div></div>";
    bootstrap.Modal.getOrCreateInstance(el).show();
  }

  // ---------- COMMUNITY ----------
  function agoShort(ms) {
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  }
  let communitySort = "top";
  async function renderCommunity() {
    let data; try { data = await API.posts(communitySort); } catch { return fail(); }
    const posts = data.posts || [];
    const isAdm = data.isAdmin;
    const reactionSet = data.reactionSet || ["👍", "❤️", "😂", "🔥", "😮"];
    const head = '<div class="mb-3"><h2 class="fw-bold mb-0"><i class="fa-solid fa-comments text-accent me-2"></i>' + esc(t("comm2.title")) + "</h2></div>" +
      '<div class="btn-group btn-group-sm mb-3"><button class="btn ' + (communitySort === "top" ? "btn-accent" : "btn-outline-secondary") + ' sort-top"><i class="fa-solid fa-fire me-1"></i>' + esc(t("comm2.top")) + "</button>" +
      '<button class="btn ' + (communitySort === "new" ? "btn-accent" : "btn-outline-secondary") + ' sort-new"><i class="fa-solid fa-clock me-1"></i>' + esc(t("comm2.new")) + "</button></div>";
    const newBox = '<div class="card wc-card border-0 mb-4"><div class="card-body">' +
      '<textarea id="npBody" class="form-control mb-2" rows="3" maxlength="2000" dir="auto" placeholder="' + esc(t("comm2.placeholder")) + '"></textarea>' +
      '<div class="d-grid"><button id="npPost" class="btn btn-accent fw-semibold"><i class="fa-solid fa-paper-plane me-1"></i>' + esc(t("comm2.post")) + "</button></div></div></div>";

    function postCard(p) {
      const av = p.avatar ? '<img src="' + esc(p.avatar) + '" class="avatar-mini me-1" alt=""/>' : '<i class="fa-solid fa-user-circle me-1"></i>';
      const canEdit = p.mine || isAdm;
      const editBtn = canEdit ? '<button class="btn btn-link btn-sm text-secondary p-0 ms-1 edit-post" data-id="' + p.id + '"><i class="fa-solid fa-pen"></i></button>' : "";
      const del = canEdit ? '<button class="btn btn-link btn-sm text-danger p-0 ms-1 del-post" data-id="' + p.id + '"><i class="fa-solid fa-trash"></i></button>' : "";
      const report = !p.mine ? '<button class="btn btn-link btn-sm text-secondary p-0 ms-1 report-post" data-id="' + p.id + '"' + (p.myReport ? " disabled" : "") + '><i class="fa-solid fa-flag"></i>' + (p.myReport ? " " + esc(t("comm2.reported")) : "") + "</button>" : "";
      const flagged = (isAdm && p.reportCount > 0) ? ' <span class="badge rounded-pill text-bg-warning"><i class="fa-solid fa-flag me-1"></i>' + p.reportCount + "</span>" : "";
      const editForm = canEdit ? '<div class="d-none mt-2" data-editpost="' + p.id + '"><textarea class="form-control mb-1 ep-body" rows="3" maxlength="2000" dir="auto">' + esc(p.body) + '</textarea><button class="btn btn-accent btn-sm ep-save" data-id="' + p.id + '">' + esc(t("comm2.save")) + "</button></div>" : "";
      const replies = {};
      p.comments.forEach((c) => { if (c.parentId) { (replies[c.parentId] = replies[c.parentId] || []).push(c); } });
      const cRow = (c, isReply) => {
        const cav = c.avatar ? '<img src="' + esc(c.avatar) + '" class="avatar-mini me-1" alt=""/>' : "";
        const cdel = (c.mine || isAdm) ? '<button class="btn btn-link btn-sm text-danger p-0 del-comment" data-id="' + c.id + '"><i class="fa-solid fa-trash"></i></button>' : "";
        const replyUi = !isReply
          ? '<button class="btn btn-link btn-sm p-0 text-secondary text-decoration-none reply-toggle" data-id="' + c.id + '"><i class="fa-solid fa-reply me-1"></i>' + esc(t("comm2.reply")) + "</button>" +
            '<div class="d-none mt-1 d-flex gap-2" data-reply="' + c.id + '"><input class="form-control form-control-sm rep-input" maxlength="1000" dir="auto" placeholder="' + esc(t("comm2.addComment")) + '"/><button class="btn btn-accent btn-sm rep-send" data-post="' + p.id + '" data-parent="' + c.id + '"><i class="fa-solid fa-paper-plane"></i></button></div>'
          : "";
        return '<div class="d-flex gap-2 py-2 border-top ' + (c.isNew ? "comment-new" : "") + (isReply ? " ms-4" : "") + '"><div class="flex-grow-1 min-w-0"><div class="small text-secondary">' + cav +
          '<span class="fw-semibold text-body">' + esc(c.username) + "</span> · " + agoShort(c.createdAt) + '</div><div class="pre-line small" dir="auto">' + esc(c.body) + "</div>" + replyUi + "</div>" + cdel + "</div>";
      };
      const comments = p.comments.filter((c) => !c.parentId)
        .map((c) => cRow(c, false) + (replies[c.id] || []).map((r) => cRow(r, true)).join("")).join("");
      const reactBar = '<div class="reaction-bar mb-2" data-id="' + p.id + '">' + reactionSet.map((em) => {
        const r = (p.reactions || []).find((x) => x.emoji === em);
        const c = r ? r.count : 0, mine = r && r.mine;
        return '<button class="reaction-btn ' + (mine ? "active" : "") + '" data-emoji="' + em + '">' + em + '<span class="rc">' + (c > 0 ? c : "") + "</span></button>";
      }).join("") + "</div>";
      const newPill = p.isNew ? ' <span class="badge rounded-pill text-bg-danger">' + esc(t("comm2.new")) + "</span>"
        : (p.hasNewComments ? ' <span class="badge rounded-pill text-bg-primary"><i class="fa-solid fa-comment-dots me-1"></i>' + esc(t("comm2.new")) + "</span>" : "");
      const cardCls = p.isNew ? " post-new" : (p.hasNewComments ? " post-newc" : "");
      return '<div class="card wc-card border-0 mb-3' + cardCls + '"><div class="card-body d-flex gap-3">' +
        '<div class="vote-col text-center" data-id="' + p.id + '">' +
          '<button class="vote-btn up ' + (p.myVote === 1 ? "active" : "") + '" data-value="1"><i class="fa-solid fa-caret-up"></i></button>' +
          '<div class="vote-score fw-bold">' + p.score + "</div>" +
          '<button class="vote-btn down ' + (p.myVote === -1 ? "active" : "") + '" data-value="-1"><i class="fa-solid fa-caret-down"></i></button></div>' +
        '<div class="flex-grow-1 min-w-0">' +
          '<div class="small text-secondary mb-1">' + av + '<span class="fw-semibold text-body">' + esc(p.username) + "</span> · " + agoShort(p.createdAt) + newPill + flagged + editBtn + del + report + "</div>" +
          '<div class="pre-line mb-2" dir="auto">' + esc(p.body) + "</div>" + editForm + reactBar +
          '<button class="btn btn-link btn-sm p-0 text-secondary text-decoration-none toggle-comments" data-id="' + p.id + '"><i class="fa-regular fa-comment me-1"></i>' + p.commentCount + " " + esc(t("comm2.comments")) + "</button>" +
          '<div class="comments-box d-none mt-2" data-id="' + p.id + '">' + comments +
            '<div class="d-flex gap-2 mt-2"><input class="form-control form-control-sm cmt-input" maxlength="1000" dir="auto" placeholder="' + esc(t("comm2.addComment")) + '"/><button class="btn btn-accent btn-sm cmt-send" data-id="' + p.id + '"><i class="fa-solid fa-paper-plane"></i></button></div>' +
          "</div></div></div></div>";
    }

    setBody(head + newBox + (posts.length ? posts.map(postCard).join("")
      : '<div class="text-center text-secondary py-5"><i class="fa-solid fa-comment-dots fa-2x mb-3 d-block"></i>' + esc(t("comm2.empty")) + "</div>"));

    document.getElementById("npPost").addEventListener("click", () => {
      const b = document.getElementById("npBody").value.trim();
      if (!b) return;
      API.addPost(b).then(renderCommunity).catch(() => toast(t("netErr"), false));
    });
    document.querySelectorAll(".vote-col").forEach((col) => {
      const id = col.dataset.id, scoreEl = col.querySelector(".vote-score");
      col.querySelectorAll(".vote-btn").forEach((btn) => btn.addEventListener("click", () => {
        const wanted = parseInt(btn.dataset.value, 10);
        const value = btn.classList.contains("active") ? 0 : wanted;
        API.votePost(id, value).then((j) => {
          scoreEl.textContent = j.score;
          col.querySelectorAll(".vote-btn").forEach((b) => b.classList.remove("active"));
          if (value !== 0) btn.classList.add("active");
        }).catch(() => {});
      }));
    });
    document.querySelectorAll(".toggle-comments").forEach((b) => b.addEventListener("click", () => {
      const box = document.querySelector('.comments-box[data-id="' + b.dataset.id + '"]');
      if (box) box.classList.toggle("d-none");
    }));
    document.querySelectorAll(".cmt-send").forEach((b) => b.addEventListener("click", () => {
      const box = document.querySelector('.comments-box[data-id="' + b.dataset.id + '"]');
      const v = box.querySelector(".cmt-input").value.trim();
      if (!v) return;
      API.addPostComment(b.dataset.id, v).then(renderCommunity).catch(() => toast(t("netErr"), false));
    }));
    document.querySelectorAll(".del-post").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Delete this post?")) return;
      API.delPost(b.dataset.id).then(renderCommunity).catch(() => toast(t("netErr"), false));
    }));
    document.querySelectorAll(".del-comment").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Delete this comment?")) return;
      API.delComment(b.dataset.id).then(renderCommunity).catch(() => toast(t("netErr"), false));
    }));
    document.querySelectorAll(".reply-toggle").forEach((b) => b.addEventListener("click", () => {
      const box = document.querySelector('[data-reply="' + b.dataset.id + '"]'); if (box) box.classList.toggle("d-none");
    }));
    document.querySelectorAll(".rep-send").forEach((b) => b.addEventListener("click", () => {
      const box = document.querySelector('[data-reply="' + b.dataset.parent + '"]');
      const v = box.querySelector(".rep-input").value.trim();
      if (!v) return;
      API.addPostComment(b.dataset.post, v, b.dataset.parent).then(renderCommunity).catch(() => toast(t("netErr"), false));
    }));
    document.querySelectorAll(".reaction-bar").forEach((bar) => {
      const id = bar.dataset.id;
      bar.querySelectorAll(".reaction-btn").forEach((btn) => btn.addEventListener("click", () => {
        API.reactPost(id, btn.dataset.emoji).then((j) => {
          if (!j.ok) return;
          bar.querySelectorAll(".reaction-btn").forEach((b2) => {
            const r = j.reactions.find((x) => x.emoji === b2.dataset.emoji);
            b2.classList.toggle("active", !!(r && r.mine));
            b2.querySelector(".rc").textContent = r && r.count > 0 ? r.count : "";
          });
        }).catch(() => {});
      }));
    });
    document.querySelector(".sort-top").addEventListener("click", () => { communitySort = "top"; renderCommunity(); });
    document.querySelector(".sort-new").addEventListener("click", () => { communitySort = "new"; renderCommunity(); });
    document.querySelectorAll(".edit-post").forEach((b) => b.addEventListener("click", () => {
      const box = document.querySelector('[data-editpost="' + b.dataset.id + '"]'); if (box) box.classList.toggle("d-none");
    }));
    document.querySelectorAll(".ep-save").forEach((b) => b.addEventListener("click", () => {
      const box = document.querySelector('[data-editpost="' + b.dataset.id + '"]');
      const v = box.querySelector(".ep-body").value.trim();
      if (!v) return;
      API.editPost(b.dataset.id, v).then(renderCommunity).catch(() => toast(t("netErr"), false));
    }));
    document.querySelectorAll(".report-post").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return;
      if (!confirm("Report this post to the admins?")) return;
      b.disabled = true;
      API.reportPost(b.dataset.id).then(() => { b.innerHTML = '<i class="fa-solid fa-flag"></i> ' + esc(t("comm2.reported")); }).catch(() => { b.disabled = false; toast(t("netErr"), false); });
    }));

    // Opening the feed marks it seen — clear the nav badge.
    communityNew = 0;
    document.querySelectorAll(".bottom-nav .nav-badge").forEach((e) => e.remove());
  }

  // ---------- PROFILE ----------
  async function renderProfile() {
    let d; try { d = await API.profile(); } catch { return fail(); }
    const s = d.stats;

    const avHtml = d.avatar ? '<img src="' + esc(d.avatar) + '" alt="avatar"/>' : '<i class="fa-solid fa-user-astronaut"></i>';
    let html = '<div class="d-flex flex-wrap align-items-center gap-3 mb-4">' +
      '<div class="profile-avatar">' + avHtml + "</div>" +
      '<div class="me-auto"><h2 class="fw-bold mb-0">' + esc(d.username) + '</h2><p class="text-secondary mb-0">' + s.totalPoints + " " + esc(t("pts")) + "</p></div>" +
      '<div class="d-flex gap-2 flex-wrap">' +
        '<button id="changePhoto" class="btn btn-outline-secondary btn-sm"><i class="fa-solid fa-flag me-1"></i>' + esc(t("profile.changePhoto")) + "</button>" +
        '<button id="changeName" class="btn btn-outline-secondary btn-sm"><i class="fa-solid fa-pen me-1"></i>' + esc(t("profile.changeName")) + "</button>" +
        '<button id="themeBtn" class="btn btn-outline-secondary btn-sm"><i class="fa-solid fa-circle-half-stroke me-1"></i>' + esc(t("profile.theme")) + "</button>" +
        '<button id="shareBtn" class="btn btn-accent btn-sm"><i class="fa-solid fa-share-nodes me-1"></i>' + esc(t("profile.share")) + "</button>" +
        '<button id="logout" class="btn btn-outline-danger btn-sm"><i class="fa-solid fa-right-from-bracket me-1"></i>' + esc(t("profile.logout")) + "</button>" +
      "</div></div>";

    html += '<div class="langrow mb-4">' + I18N.LANGS.map((l) =>
      '<button class="btn btn-sm ' + (l.c === I18N.lang() ? "btn-accent" : "btn-outline-secondary") + '" data-l="' + l.c + '">' + esc(l.n) + "</button>").join("") + "</div>";

    // champion banner
    html += '<div class="card wc-card border-0 mb-4 champion-banner"><div class="card-body">' +
      '<div class="d-flex flex-wrap align-items-center gap-2 mb-3"><h6 class="fw-bold mb-0"><i class="fa-solid fa-crown text-accent me-2"></i>' + esc(t("champ.title")) + "</h6>" +
      (d.championLocked ? '<span class="badge wc-badge badge-locked ms-auto"><i class="fa-solid fa-lock me-1"></i>' + esc(t("champ.locked")) + "</span>"
        : '<span class="badge wc-badge badge-open ms-auto"><i class="fa-solid fa-hourglass-half me-1"></i>' + esc(t("champ.locksIn")) + ' <strong id="cd">…</strong></span>') + "</div>";
    if (d.championLocked) {
      html += "<p class=\"mb-0\">" + esc(t("champ.locked")) + (d.championPick ? ": <b>" + esc(d.championLabel) + "</b>" : "") + "</p>";
    } else if (!d.teams.length) {
      html += '<p class="text-secondary mb-0">' + esc(t("champ.teamsAppear")) + "</p>";
    } else {
      html += '<form id="cf" class="row g-2 align-items-center"><div class="col-12 col-md"><select id="champ" class="form-select" required><option value="">' + esc(t("champ.choose")) + "</option>" +
        d.teams.map((tm) => '<option value="' + esc(tm.value) + '"' + (d.championPick === tm.value ? " selected" : "") + ">" + esc(tm.label) + "</option>").join("") +
        '</select></div><div class="col-12 col-md-auto d-grid"><button class="btn btn-accent fw-semibold"><i class="fa-solid fa-crown me-1"></i>' + esc(t("champ.save")) + "</button></div></form>";
      if (d.championPick) html += '<p class="text-secondary small mt-2 mb-0">' + esc(t("champ.current")) + " <b>" + esc(d.championLabel) + "</b> — " + esc(t("champ.canChange")) + "</p>";
    }
    if (d.actualChampion) {
      const ok = d.championPick && d.championPick === d.actualChampion;
      html += '<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">' + esc(t("champ.actual")) + " <b>" + esc(d.actualChampionLabel) + "</b> " +
        (d.championPick ? '<span class="badge wc-badge ' + (ok ? "badge-done" : "badge-locked") + '">' + esc(ok ? t("champ.correct") : t("champ.wrong")) + "</span>" : "") + "</div>";
    }
    html += "</div></div>";

    // stats grid (4 cards, like website)
    const stat = (icon, val, label, sub) => '<div class="col-6 col-lg-3"><div class="card wc-card stat-card border-0 h-100"><div class="card-body">' +
      '<div class="stat-icon"><i class="fa-solid ' + icon + '"></i></div><div class="stat-value">' + val + '</div><div class="stat-label">' + esc(label) +
      (sub ? ' <span class="text-secondary">' + esc(sub) + "</span>" : "") + "</div></div></div></div>";
    html += '<div class="row g-3 mb-4">' +
      stat("fa-star", '<span class="text-accent">' + s.totalPoints + "</span>", t("stat.totalPoints")) +
      stat("fa-bullseye", '<span class="text-gold">' + s.exact + "</span>", t("stat.exact"), t("stat.pts4")) +
      stat("fa-arrows-left-right", s.difference, t("stat.difference"), t("stat.pts2")) +
      stat("fa-check-double", s.outcome, t("stat.outcomes"), t("stat.pt1")) +
      stat("fa-percent", s.hitRate + "%", t("stat.hitRate"), t("stat.scoredP")) + "</div>";

    // tallies
    html += '<div class="d-flex flex-wrap gap-2 mb-4">' +
      '<span class="badge wc-badge badge-open"><i class="fa-solid fa-list-check me-1"></i>' + s.made + " " + esc(t("stat.made")) + "</span>" +
      '<span class="badge wc-badge badge-done"><i class="fa-solid fa-flag-checkered me-1"></i>' + s.scored + " " + esc(t("stat.scored2")) + "</span>" +
      '<span class="badge wc-badge badge-locked"><i class="fa-solid fa-hourglass-half me-1"></i>' + s.pending + " " + esc(t("stat.pending")) + "</span>" +
      '<span class="badge wc-badge badge-locked"><i class="fa-solid fa-xmark me-1"></i>' + s.missed + " " + esc(t("stat.missed")) + "</span></div>";

    // achievements
    if (d.achievements && d.achievements.length) {
      const badges = d.achievements.map((a) => '<span class="ach-badge ' + (a.earned ? "earned" : "") + '"><i class="fa-solid ' + a.icon + ' me-1"></i>' + esc(t("ach." + a.key)) + "</span>").join("");
      const legend = d.achievements.map((a) =>
        '<li class="mb-1"><i class="fa-solid ' + a.icon + ' me-2 ' + (a.earned ? "text-accent" : "") + '" style="width:16px;text-align:center"></i><strong class="text-body">' + esc(t("ach." + a.key)) + "</strong> — " + esc(t("ach." + a.key + "D")) + (a.earned ? ' <i class="fa-solid fa-circle-check text-success"></i>' : "") + "</li>").join("");
      html += '<div class="card wc-card border-0 mb-4"><div class="card-body"><h6 class="fw-bold mb-3"><i class="fa-solid fa-trophy text-accent me-2"></i>' + esc(t("ach.title")) + '</h6>' +
        '<div class="d-flex flex-wrap gap-2">' + badges + '</div><ul class="list-unstyled small text-secondary mb-0 mt-3">' + legend + "</ul></div></div>";
    }

    // history
    html += '<h5 class="fw-semibold mb-3"><i class="fa-solid fa-clock-rotate-left text-accent me-2"></i>' + esc(t("hist.title")) + "</h5>";
    if (!d.history.length) html += '<div class="text-center text-secondary py-4">' + esc(t("hist.none")) + "</div>";
    else html += '<div class="card wc-card border-0"><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th class="ps-4">' +
      esc(t("hist.match")) + "</th><th>" + esc(t("hist.kickoff")) + '</th><th class="text-center">' + esc(t("hist.yourPick")) + '</th><th class="text-center">' + esc(t("hist.result")) + '</th><th class="text-end pe-4">' + esc(t("hist.points")) + "</th></tr></thead><tbody>" +
      d.history.map((h) => '<tr><td class="ps-4 fw-semibold">' + esc(h.teamA) + ' <span class="text-secondary">' + esc(t("vs")) + "</span> " + esc(h.teamB) +
        '</td><td class="text-secondary small">' + esc(fmtTime(h.kickoff)) + '</td><td class="text-center fw-semibold">' + esc(h.pred) +
        '</td><td class="text-center">' + (h.result ? '<span class="text-gold fw-bold">' + esc(h.result) + "</span>" : '<span class="text-secondary">—</span>') +
        '</td><td class="text-end pe-4">' + (h.points == null ? '<span class="badge wc-badge badge-locked">' + esc(t("badge.locked")) + "</span>" :
          h.points === 4 ? '<span class="badge wc-badge badge-done">+4</span>' : h.points === 2 ? '<span class="badge wc-badge badge-open">+2</span>' : h.points === 1 ? '<span class="badge wc-badge badge-open">+1</span>' : '<span class="badge wc-badge badge-locked">0</span>') + "</td></tr>").join("") +
      "</tbody></table></div></div>";

    setBody(html);

    document.getElementById("logout").addEventListener("click", (e) => { e.preventDefault(); API.logout(); renderLogin(); });
    document.getElementById("changePhoto").addEventListener("click", () => openFlagPicker(d.flags || []));
    document.getElementById("themeBtn").addEventListener("click", toggleTheme);
    document.getElementById("shareBtn").addEventListener("click", () => shareCard({ name: d.username, rank: d.rank, points: s.totalPoints, hit: s.hitRate }));
    document.getElementById("changeName").addEventListener("click", () => openNameEditor(d.username));
    document.querySelectorAll("[data-l]").forEach((b) => b.addEventListener("click", () => { I18N.setLang(b.dataset.l); applyDir(); go("profile"); }));
    const cf = document.getElementById("cf");
    if (cf) cf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pick = document.getElementById("champ").value;
      if (!pick) return;
      try { await API.champion(pick); toast(t("saved"), true); go("profile"); }
      catch (err) { toast(err.status === 403 ? t("champ.locked") : t("netErr"), false); }
    });
    if (!d.championLocked) {
      const cd = document.getElementById("cd");
      const tick = () => {
        const ms = d.championLockMs - Date.now();
        if (ms <= 0) { go("profile"); return; }
        const dd = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), mi = Math.floor(ms % 3600000 / 60000), se = Math.floor(ms % 60000 / 1000);
        if (cd) cd.textContent = (dd > 0 ? dd + "d " : "") + h + "h " + mi + "m " + se + "s";
      };
      tick(); countdownTimer = setInterval(tick, 1000);
    }
  }

  // ---------- ADMIN ----------
  let adminData = null;
  function fmtKick(ms) {
    return new Date(ms).toLocaleString(loc(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function miniFlag(url) {
    return url ? '<img src="' + esc(url) + '" class="me-1" style="width:18px;height:13px;object-fit:cover;border-radius:2px" alt=""/>' : "";
  }
  function adminModal(title, bodyHtml) {
    let el = document.getElementById("adminModal");
    if (!el) { el = document.createElement("div"); el.id = "adminModal"; el.className = "modal fade"; el.tabIndex = -1; document.body.appendChild(el); }
    el.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content wc-card border-0">' +
      '<div class="modal-header"><h5 class="modal-title fw-bold">' + title + '</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body" id="amBody">' + bodyHtml + "</div></div></div>";
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
    return { el: el, body: document.getElementById("amBody"), modal: modal };
  }
  function adminDo(promise, modal, okMsg) {
    return promise.then(() => { if (modal) modal.hide(); toast(okMsg || "Done", true); renderAdmin(); })
      .catch((e) => toast(e && e.data && e.data.error ? e.data.error : t("netErr"), false));
  }
  async function adminRefresh() { try { adminData = await API.admin.overview(); } catch (e) { /* keep old */ } }

  async function renderAdmin() {
    let d; try { d = await API.admin.overview(); } catch { return fail(); }
    adminData = d;
    const tile = (id, icon, label) =>
      '<div class="col-4"><button class="admin-tile w-100" data-act="' + id + '"><i class="fa-solid ' + icon + '"></i><span>' + esc(label) + "</span></button></div>";
    let html = '<div class="mb-3"><h2 class="fw-bold mb-0"><i class="fa-solid fa-screwdriver-wrench text-accent me-2"></i>Admin</h2></div>';
    html += '<div class="row g-2 mb-4">' +
      tile("addMatch", "fa-plus", "Add match") +
      tile("pred", "fa-pen", "Prediction") +
      tile("polls", "fa-square-poll-vertical", "Polls") +
      tile("anns", "fa-bullhorn", "Announce") +
      tile("champ", "fa-crown", "Champion") +
      tile("import", "fa-cloud-arrow-down", "Import") +
      tile("users", "fa-users", "Users") +
      "</div>";
    html += '<h6 class="fw-bold mb-2">Matches</h6><div class="card wc-card border-0"><div class="table-responsive"><table class="table align-middle mb-0"><tbody>';
    if (!d.matches.length) html += '<tr><td class="text-center text-secondary py-3">No matches.</td></tr>';
    d.matches.forEach((m) => { html += adminMatchRow(m); });
    html += "</tbody></table></div></div>";
    setBody(html);
    document.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => adminAction(b.dataset.act)));
    bindAdminMatches();
  }

  function adminMatchRow(m) {
    const title = '<div class="fw-semibold small">' + miniFlag(m.flagA) + esc(m.teamA) + ' <span class="text-secondary">vs</span> ' + miniFlag(m.flagB) + esc(m.teamB) + "</div>" +
      '<div class="text-secondary" style="font-size:.72rem">' + fmtKick(m.kickoff) + "</div>";
    let right;
    if (m.status === "completed") {
      right = '<span class="fw-bold me-2">' + m.actualA + " - " + m.actualB + '</span><i class="fa-solid fa-lock text-secondary me-2"></i>' +
        '<button class="btn btn-outline-danger btn-sm" data-del="' + m.id + '"><i class="fa-solid fa-trash"></i></button>';
    } else {
      const va = m.liveA != null ? m.liveA : "", vb = m.liveB != null ? m.liveB : "";
      right = '<span class="d-inline-flex align-items-center gap-1 flex-wrap justify-content-end" data-row="' + m.id + '">' +
        '<input type="number" min="0" class="form-control form-control-sm text-center am-a" value="' + va + '" style="width:44px"/><span>-</span>' +
        '<input type="number" min="0" class="form-control form-control-sm text-center am-b" value="' + vb + '" style="width:44px"/>' +
        '<button class="btn btn-outline-danger btn-sm am-live">Live</button>' +
        '<button class="btn btn-accent btn-sm am-final"><i class="fa-solid fa-check"></i></button>' +
        '<button class="btn btn-outline-danger btn-sm" data-del="' + m.id + '"><i class="fa-solid fa-trash"></i></button></span>';
    }
    return "<tr><td>" + title + '</td><td class="text-end">' + right + "</td></tr>";
  }

  function bindAdminMatches() {
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Delete this match? Removes its predictions and reverses points.")) return;
      adminDo(API.admin.delMatch(b.dataset.del), null, "Match deleted");
    }));
    document.querySelectorAll("[data-row]").forEach((row) => {
      const id = row.dataset.row;
      const a = () => row.querySelector(".am-a").value, b = () => row.querySelector(".am-b").value;
      row.querySelector(".am-live").addEventListener("click", () => adminDo(API.admin.live(id, a(), b()), null, "Live score updated"));
      row.querySelector(".am-final").addEventListener("click", () => {
        if (!confirm("Finalize result? Locks the match and scores all predictions.")) return;
        adminDo(API.admin.result(id, a(), b()), null, "Result saved");
      });
    });
  }

  function adminAction(act) {
    const d = adminData || {};
    if (act === "import") {
      if (!confirm("Import / refresh fixtures from the football API?")) return;
      adminDo(API.admin.importFixtures(), null, "Import done");
    } else if (act === "addMatch") {
      const m = adminModal("Add a match",
        '<div class="mb-2"><label class="form-label small text-secondary">Team A</label><input id="amTeamA" class="form-control" placeholder="Brazil"/></div>' +
        '<div class="mb-2"><label class="form-label small text-secondary">Team B</label><input id="amTeamB" class="form-control" placeholder="Argentina"/></div>' +
        '<div class="mb-3"><label class="form-label small text-secondary">Kickoff</label><input id="amKick" type="datetime-local" class="form-control"/></div>' +
        '<button id="amAdd" class="btn btn-accent w-100 fw-semibold">Add</button>');
      m.body.querySelector("#amAdd").addEventListener("click", () => {
        const ta = m.body.querySelector("#amTeamA").value.trim(), tb = m.body.querySelector("#amTeamB").value.trim(), k = m.body.querySelector("#amKick").value;
        if (!ta || !tb || !k) return toast("Fill all fields", false);
        adminDo(API.admin.addMatch(ta, tb, k), m.modal, "Match added");
      });
    } else if (act === "champ") {
      const opts = '<option value="">— Not decided —</option>' + d.teams.map((tm) =>
        '<option value="' + esc(tm.name) + '"' + (d.champion.actual === tm.name ? " selected" : "") + ">" + esc(tm.label) + "</option>").join("");
      const m = adminModal("Set Champion",
        '<p class="small text-secondary">Awards +' + d.champion.bonus + ' to everyone who picked this team.</p>' +
        '<select id="amChamp" class="form-select mb-3">' + opts + "</select>" +
        '<button id="amChampSave" class="btn btn-accent w-100 fw-semibold">Save Champion</button>');
      m.body.querySelector("#amChampSave").addEventListener("click", () => {
        if (!confirm("Set champion and award the bonus?")) return;
        adminDo(API.admin.champion(m.body.querySelector("#amChamp").value), m.modal, "Champion set");
      });
    } else if (act === "pred") {
      const uOpts = '<option value="">— user —</option>' + d.users.map((u) => '<option value="' + u.id + '">' + esc(u.username) + "</option>").join("");
      const mOpts = '<option value="">— match —</option>' + d.matches.map((mm) => '<option value="' + mm.id + '">' + esc(mm.teamA) + " vs " + esc(mm.teamB) + "</option>").join("");
      const m = adminModal("Add / edit prediction",
        '<div class="mb-2"><label class="form-label small text-secondary">User</label><select id="apUser" class="form-select">' + uOpts + "</select></div>" +
        '<div class="mb-2"><label class="form-label small text-secondary">Match</label><select id="apMatch" class="form-select">' + mOpts + "</select></div>" +
        '<div class="d-flex gap-2 mb-3">' +
          '<div><label class="form-label small text-secondary">A</label><input id="apA" type="number" min="0" class="form-control text-center"/></div>' +
          '<div><label class="form-label small text-secondary">B</label><input id="apB" type="number" min="0" class="form-control text-center"/></div>' +
          '<div><label class="form-label small text-secondary">Pts</label><input id="apP" type="number" min="0" class="form-control text-center" placeholder="auto"/></div></div>' +
        '<button id="apSave" class="btn btn-accent w-100 fw-semibold">Save</button>');
      m.body.querySelector("#apSave").addEventListener("click", () => {
        const uid = m.body.querySelector("#apUser").value, mid = m.body.querySelector("#apMatch").value;
        const a = m.body.querySelector("#apA").value, b = m.body.querySelector("#apB").value, p = m.body.querySelector("#apP").value;
        if (!uid || !mid || a === "" || b === "") return toast("Pick user, match and score", false);
        adminDo(API.admin.prediction(uid, mid, a, b, p), m.modal, "Prediction saved");
      });
    } else if (act === "anns") {
      adminAnnouncements();
    } else if (act === "polls") {
      adminPolls();
    } else if (act === "users") {
      adminUsers();
    }
  }

  async function adminAnnouncements() {
    await adminRefresh();
    const list = adminData.announcements.map((a) =>
      '<li class="d-flex align-items-start gap-2 py-2 border-top"><span class="badge ' + (a.active ? "text-bg-success" : "text-bg-secondary") + '">' + (a.active ? "On" : "Off") + "</span>" +
      '<span class="flex-grow-1 small pre-line" dir="auto">' + esc(a.message) + "</span>" +
      '<button class="btn btn-outline-secondary btn-sm" data-tog="' + a.id + '"><i class="fa-solid fa-eye"></i></button>' +
      '<button class="btn btn-outline-danger btn-sm" data-del="' + a.id + '"><i class="fa-solid fa-trash"></i></button></li>').join("");
    const m = adminModal("Announcements",
      '<textarea id="annMsg" class="form-control mb-2" rows="3" maxlength="500" placeholder="Write an announcement… (emojis + line breaks OK)" dir="auto"></textarea>' +
      '<button id="annPost" class="btn btn-accent w-100 fw-semibold mb-3">Post</button>' +
      '<ul class="list-unstyled mb-0">' + list + "</ul>");
    m.body.querySelector("#annPost").addEventListener("click", () => {
      const msg = m.body.querySelector("#annMsg").value.trim();
      if (!msg) return toast("Empty", false);
      API.admin.announce(msg).then(adminAnnouncements).catch(() => toast(t("netErr"), false));
    });
    m.body.querySelectorAll("[data-tog]").forEach((b) => b.addEventListener("click", () => API.admin.announceToggle(b.dataset.tog).then(adminAnnouncements).catch(() => toast(t("netErr"), false))));
    m.body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { if (confirm("Delete this announcement?")) API.admin.announceDelete(b.dataset.del).then(adminAnnouncements).catch(() => toast(t("netErr"), false)); }));
  }

  async function adminPolls() {
    await adminRefresh();
    const list = adminData.polls.map((p) => {
      const voters = p.voters.length ? '<div class="mt-1">' + p.voters.map((v) =>
        '<span class="badge rounded-pill ' + (v.choice ? "text-bg-success" : "text-bg-danger") + ' me-1 mb-1">' + esc(v.username) + "</span>").join("") + "</div>" : "";
      return '<li class="py-2 border-top">' +
        '<div class="d-flex align-items-center gap-2"><span class="badge ' + (p.active ? "text-bg-success" : "text-bg-secondary") + '">' + (p.active ? "On" : "Off") + "</span>" +
        '<span class="flex-grow-1 small pre-line" dir="auto">' + esc(p.question) + "</span>" +
        '<span class="small text-success fw-bold">✓' + p.yes + '</span><span class="small text-danger fw-bold">✗' + p.no + "</span></div>" + voters +
        '<div class="d-flex gap-2 mt-1">' +
          '<button class="btn btn-outline-secondary btn-sm" data-edit="' + p.id + '"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-outline-secondary btn-sm" data-tog="' + p.id + '"><i class="fa-solid fa-power-off"></i></button>' +
          '<button class="btn btn-outline-danger btn-sm" data-del="' + p.id + '"><i class="fa-solid fa-trash"></i></button></div>' +
        '<div class="d-none mt-2" data-editbox="' + p.id + '"><textarea class="form-control mb-1" rows="3" dir="auto">' + esc(p.question) + "</textarea>" +
          '<button class="btn btn-accent btn-sm" data-save="' + p.id + '">Save</button></div></li>';
    }).join("");
    const m = adminModal("Feature polls",
      '<textarea id="pollQ" class="form-control mb-2" rows="3" maxlength="500" placeholder="Ask a Yes/No question… (emojis + line breaks OK)" dir="auto"></textarea>' +
      '<button id="pollNew" class="btn btn-accent w-100 fw-semibold mb-3">Create poll</button>' +
      '<ul class="list-unstyled mb-0">' + list + "</ul>");
    m.body.querySelector("#pollNew").addEventListener("click", () => {
      const q = m.body.querySelector("#pollQ").value.trim();
      if (!q) return toast("Empty", false);
      API.admin.poll(q).then(adminPolls).catch(() => toast(t("netErr"), false));
    });
    m.body.querySelectorAll("[data-tog]").forEach((b) => b.addEventListener("click", () => API.admin.pollToggle(b.dataset.tog).then(adminPolls).catch(() => toast(t("netErr"), false))));
    m.body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { if (confirm("Delete this poll and its votes?")) API.admin.pollDelete(b.dataset.del).then(adminPolls).catch(() => toast(t("netErr"), false)); }));
    m.body.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { const box = m.body.querySelector('[data-editbox="' + b.dataset.edit + '"]'); if (box) box.classList.toggle("d-none"); }));
    m.body.querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", () => {
      const box = m.body.querySelector('[data-editbox="' + b.dataset.save + '"]');
      const q = box.querySelector("textarea").value.trim();
      if (!q) return toast("Empty", false);
      API.admin.pollEdit(b.dataset.save, q).then(adminPolls).catch(() => toast(t("netErr"), false));
    }));
  }

  async function adminUsers() {
    await adminRefresh();
    const list = adminData.users.map((u) =>
      '<li class="py-2 border-top">' +
        '<div class="d-flex align-items-center gap-2"><span class="fw-semibold flex-grow-1">' + esc(u.username) + (u.isAdmin ? ' <span class="badge text-bg-warning">Admin</span>' : "") + '</span><span class="text-accent fw-bold">' + u.totalPoints + "</span></div>" +
        '<div class="d-flex flex-wrap gap-1 mt-1">' +
          '<button class="btn btn-outline-secondary btn-sm" data-preds="' + u.id + '" title="Predictions"><i class="fa-solid fa-list-check"></i></button>' +
          '<button class="btn btn-outline-secondary btn-sm" data-ren="' + u.id + '" title="Rename"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-outline-secondary btn-sm" data-pin="' + u.id + '" title="Reset PIN"><i class="fa-solid fa-key"></i></button>' +
          '<button class="btn btn-outline-secondary btn-sm" data-rst="' + u.id + '" title="Reset points"><i class="fa-solid fa-rotate-left"></i></button>' +
          '<button class="btn ' + (u.isAdmin ? "btn-warning" : "btn-outline-warning") + ' btn-sm" data-adm="' + u.id + '" title="Admin"><i class="fa-solid fa-shield-halved"></i></button>' +
          '<button class="btn btn-outline-danger btn-sm" data-del="' + u.id + '" title="Delete"><i class="fa-solid fa-trash"></i></button></div>' +
        '<div class="d-none mt-2" data-renbox="' + u.id + '"><div class="input-group input-group-sm"><input class="form-control" value="' + esc(u.username) + '" maxlength="20"/><button class="btn btn-accent" data-rensave="' + u.id + '">Save</button></div></div></li>').join("");
    const m = adminModal("Users", '<ul class="list-unstyled mb-0">' + list + "</ul>");
    m.body.querySelectorAll("[data-adm]").forEach((b) => b.addEventListener("click", () => { if (confirm("Toggle admin access for this user?")) API.admin.userToggleAdmin(b.dataset.adm).then(adminUsers).catch(() => toast(t("netErr"), false)); }));
    m.body.querySelectorAll("[data-rst]").forEach((b) => b.addEventListener("click", () => { if (confirm("Reset this user's points to 0?")) API.admin.userReset(b.dataset.rst).then(adminUsers).catch(() => toast(t("netErr"), false)); }));
    m.body.querySelectorAll("[data-pin]").forEach((b) => b.addEventListener("click", () => { if (confirm("Clear this user's PIN? They set a new one next login.")) API.admin.userResetPin(b.dataset.pin).then(() => toast("PIN cleared", true)).catch(() => toast(t("netErr"), false)); }));
    m.body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { if (confirm("Delete this user and all their predictions?")) API.admin.userDelete(b.dataset.del).then(adminUsers).catch(() => toast(t("netErr"), false)); }));
    m.body.querySelectorAll("[data-ren]").forEach((b) => b.addEventListener("click", () => { const box = m.body.querySelector('[data-renbox="' + b.dataset.ren + '"]'); if (box) box.classList.toggle("d-none"); }));
    m.body.querySelectorAll("[data-rensave]").forEach((b) => b.addEventListener("click", () => {
      const box = m.body.querySelector('[data-renbox="' + b.dataset.rensave + '"]');
      const name = box.querySelector("input").value.trim();
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(name)) return toast(t("login.invalid"), false);
      API.admin.userRename(b.dataset.rensave, name).then(adminUsers).catch((e) => toast(e && e.status === 409 ? t("profile.taken") : t("netErr"), false));
    }));
    m.body.querySelectorAll("[data-preds]").forEach((b) => b.addEventListener("click", () => showUserPreds(b.dataset.preds, null)));
  }

  function showUserPreds(uid, editId) {
    API.admin.userPreds(uid).then((r) => {
      const body = document.getElementById("amBody");
      if (!body) return;
      const rows = r.predictions.length ? r.predictions.map((p) => {
        if (p.matchId === editId) {
          return "<tr><td>" + esc(p.match) + "</td>" +
            '<td class="text-center"><div class="d-inline-flex gap-1 align-items-center"><input type="number" min="0" class="form-control form-control-sm text-center ea" style="width:40px" value="' + esc(p.predA) + '"/><span>-</span><input type="number" min="0" class="form-control form-control-sm text-center eb" style="width:40px" value="' + esc(p.predB) + '"/></div></td>' +
            '<td class="text-center">' + esc(p.result) + "</td>" +
            '<td class="text-end"><input type="number" min="0" class="form-control form-control-sm text-center ep" style="width:50px" value="' + esc(p.points) + '"/></td>' +
            '<td class="text-end"><button class="btn btn-accent btn-sm sv" data-match="' + esc(p.matchId) + '"><i class="fa-solid fa-check"></i></button> <button class="btn btn-outline-secondary btn-sm cx"><i class="fa-solid fa-xmark"></i></button></td></tr>';
        }
        return "<tr><td>" + esc(p.match) + '</td><td class="text-center fw-semibold">' + esc(p.pick) + '</td><td class="text-center">' + esc(p.result) + '</td><td class="text-end fw-bold text-accent">' + p.points + "</td>" +
          '<td class="text-end"><button class="btn btn-outline-secondary btn-sm ed" data-match="' + esc(p.matchId) + '"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-outline-danger btn-sm del" data-match="' + esc(p.matchId) + '"><i class="fa-solid fa-trash"></i></button></td></tr>';
      }).join("") : '<tr><td colspan="5" class="text-center text-secondary py-3">No predictions.</td></tr>';
      body.innerHTML = '<button class="btn btn-outline-secondary btn-sm mb-2" id="amBack"><i class="fa-solid fa-arrow-left me-1"></i>Back</button>' +
        '<h6 class="fw-bold">' + esc(r.username) + '</h6><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Match</th><th class="text-center">Pick</th><th class="text-center">Result</th><th class="text-end">Pts</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>";
      body.querySelector("#amBack").addEventListener("click", adminUsers);
      body.querySelectorAll(".ed").forEach((b) => b.addEventListener("click", () => showUserPreds(uid, b.dataset.match)));
      body.querySelectorAll(".cx").forEach((b) => b.addEventListener("click", () => showUserPreds(uid, null)));
      body.querySelectorAll(".del").forEach((b) => b.addEventListener("click", () => {
        if (!confirm("Delete this prediction? Any points it earned are removed.")) return;
        b.disabled = true;
        API.admin.userPredDelete(uid, b.dataset.match).then(() => showUserPreds(uid, null)).catch(() => { b.disabled = false; toast(t("netErr"), false); });
      }));
      body.querySelectorAll(".sv").forEach((b) => b.addEventListener("click", () => {
        const tr = b.closest("tr");
        const a = tr.querySelector(".ea").value, bb = tr.querySelector(".eb").value, p = tr.querySelector(".ep").value;
        if (a === "" || bb === "") return toast("Enter a score", false);
        b.disabled = true;
        API.admin.userPredEdit(uid, b.dataset.match, a, bb, p).then(() => showUserPreds(uid, null)).catch(() => { b.disabled = false; toast(t("netErr"), false); });
      }));
    }).catch(() => toast(t("netErr"), false));
  }

  // ---------- boot ----------
  let started = false;
  function start() {
    if (started) return; started = true;
    applyDir();
    applyTheme();
    checkUpdate();
    registerPush();
    if (API.token()) checkAdmin().then(() => go("fixtures")); else renderLogin();
  }
  document.addEventListener("deviceready", start, false);
  setTimeout(start, 1200);
})();
