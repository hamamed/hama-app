/* HAMA WC 2026 — Cordova app. Renders the same markup/classes as the website. */
(function () {
  const t = I18N.t;
  const app = () => document.getElementById("app");
  const LOCALE = { en: "en-GB", fr: "fr-FR", ar: "ar" };
  const APP_VERSION = "1.4.0"; // bump this when you build a new APK
  let countdownTimer = null, liveTimer = null;
  let appUpdate = { available: false, url: "https://koydam.com/download/hama.apk" };
  let isAdminUser = false;

  async function checkAdmin() {
    try { const r = await API.me(); isAdminUser = !!r.isAdmin; } catch (e) { isAdminUser = false; }
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
      { id: "profile", icon: "fa-user", label: t("nav.profile") },
    ];
    if (isAdminUser) tabs.push({ id: "admin", icon: "fa-screwdriver-wrench", label: "Admin" });
    app().innerHTML =
      '<nav class="navbar wc-navbar"><div class="container">' +
        '<a class="navbar-brand d-flex align-items-center" href="#"><img class="brand-logo" src="img/logo.png" onerror="this.style.display=\'none\'"/></a>' +
        '<div class="dropdown ms-auto"><a class="nav-link dropdown-toggle lang-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">' +
          '<i class="fa-solid fa-globe me-1"></i>' + I18N.lang().toUpperCase() + "</a>" +
          '<ul class="dropdown-menu dropdown-menu-end">' + langItems + "</ul></div>" +
        '<span class="badge wc-userchip ms-2"><i class="fa-solid fa-user me-1"></i>' + esc(u.username || "") + "</span>" +
        (appUpdate.available ? '<a id="updateBtn" href="#" class="btn btn-accent btn-sm ms-2"><i class="fa-solid fa-circle-arrow-down me-1"></i>' + esc(t("app.update")) + "</a>" : "") +
      "</div></nav>" +
      '<div class="container py-4" id="screen">' + bodyHtml + "</div>" +
      '<nav class="bottom-nav">' + tabs.map((x) =>
        '<button class="bottom-nav-item ' + (x.id === activeTab ? "active" : "") + '" data-tab="' + x.id + '">' +
        '<i class="fa-solid ' + x.icon + '"></i><span>' + esc(x.label) + "</span></button>").join("") + "</nav>";

    app().querySelectorAll(".bottom-nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    app().querySelectorAll("[data-l]").forEach((b) =>
      b.addEventListener("click", (e) => { e.preventDefault(); I18N.setLang(b.dataset.l); applyDir(); go(activeTab); }));
    const ub = document.getElementById("updateBtn");
    if (ub) ub.addEventListener("click", (e) => { e.preventDefault(); openExternal(appUpdate.url); });
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

  function go(tab) {
    clearTimers();
    const map = { fixtures: renderFixtures, groups: renderGroups, ranks: renderRanks, profile: renderProfile, admin: renderAdmin };
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
    let sel = counts[today] ? today : "all";

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
      c.addEventListener("click", () => { sel = c.dataset.day; paint(); centerActive(true); }));
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

  function badgeHtml(b, pts) {
    if (b === "completed") return '<span class="badge wc-badge badge-done"><i class="fa-solid fa-flag-checkered me-1"></i>' + esc(t("legend.completed")) + (pts != null ? " (+" + pts + ")" : "") + "</span>";
    if (b === "live") return '<span class="badge wc-badge badge-live"><span class="live-dot"></span>' + esc(t("badge.live")) + "</span>";
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
        }
      }
      bottom = '<div class="text-center small">' + pick + "</div>" +
        '<div class="mt-2 text-center"><button type="button" class="btn btn-link p-0 small text-accent text-decoration-none see-all" data-id="' + m.id + '">' +
        '<i class="fa-solid fa-people-group me-1"></i>' + esc(t("seeAll")) + "</button></div>";
    }

    return '<div class="col-12 col-md-6"><div class="card wc-card h-100 border-0 match-card match-' + m.badge + '"><div class="card-body d-flex flex-column">' +
      '<div class="d-flex justify-content-between align-items-center mb-3">' + badgeHtml(m.badge, m.badge === "completed" && m.pred ? m.pred.pts : null) +
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
      let h = '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th style="width:42px">#</th><th>' + esc(t("lb.player")) +
        '</th><th class="text-center">' + esc(t("mp.pick")) + "</th>" + (j.completed ? '<th class="text-end">' + esc(t("lb.points")) + "</th>" : "") + "</tr></thead><tbody>";
      j.preds.forEach((p, i) => {
        let pts = "";
        if (j.completed) { const b = p.pts === 4 ? "badge-done" : p.pts > 0 ? "badge-open" : "badge-locked"; pts = '<td class="text-end"><span class="badge wc-badge ' + b + '">' + (p.pts > 0 ? "+" : "") + p.pts + "</span></td>"; }
        const mine = p.username === me;
        const av = p.avatar ? '<img src="' + esc(p.avatar) + '" class="avatar-mini me-2" alt=""/>' : "";
        h += '<tr class="' + (mine ? "row-me" : "") + '"><td class="text-secondary">' + (i + 1) + '</td><td class="fw-semibold">' + av + esc(p.username) +
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
  async function renderGroups() {
    let data; try { data = await API.standings(); } catch { return fail(); }
    const groups = (data.groups || []).filter((g) => g.rows.length);
    const head = '<div class="mb-4"><h2 class="fw-bold mb-0"><i class="fa-solid fa-table-cells-large text-accent me-2"></i>' + esc(t("st.title")) + "</h2></div>";
    if (!groups.length) return setBody(head + '<div class="card wc-card border-0"><div class="card-body text-center text-secondary py-5"><i class="fa-solid fa-table-list fa-2x mb-3 d-block"></i>' + esc(t("st.none")) + "</div></div>");

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
      return '<div class="podium-place podium-' + rank + '" data-id="' + esc(u.id) + '">' +
        '<div class="podium-ava-wrap">' + ava + '<span class="medal medal-' + cls + ' podium-medal">' + rank + "</span></div>" +
        '<div class="podium-name">' + esc(u.username) + "</div>" +
        '<div class="podium-points">' + u.totalPoints + " " + esc(t("pts")) + "</div>" +
        '<div class="podium-bar">' + rank + "</div></div>";
    };
    const podium = '<div class="card-body pb-0"><div class="podium mb-0">' +
      podPlace(users[1], 2) + podPlace(users[0], 1) + podPlace(users[2], 3) + "</div></div>";

    let html = head + '<div class="card wc-card border-0">' + podium + '<div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
      '<thead><tr><th class="ps-4" style="width:70px">' + esc(t("lb.rank")) + '</th><th style="width:54px" class="text-center"><i class="fa-solid fa-arrows-up-down"></i></th><th>' +
      esc(t("lb.player")) + '</th><th class="text-end pe-4">' + esc(t("lb.points")) + "</th></tr></thead><tbody>";
    users.forEach((u) => {
      const medal = u.rank === 1 ? '<span class="medal medal-gold">1</span>' : u.rank === 2 ? '<span class="medal medal-silver">2</span>' :
        u.rank === 3 ? '<span class="medal medal-bronze">3</span>' : '<span class="text-secondary">#' + u.rank + "</span>";
      const move = u.move > 0 ? '<span class="text-success"><i class="fa-solid fa-caret-up"></i> ' + u.move + "</span>" :
        u.move < 0 ? '<span class="text-danger"><i class="fa-solid fa-caret-down"></i> ' + -u.move + "</span>" :
        '<span class="text-secondary"><i class="fa-solid fa-minus"></i></span>';
      const av = u.avatar ? '<img src="' + esc(u.avatar) + '" class="avatar-mini me-2" alt=""/>' : '<i class="fa-solid fa-user-circle text-secondary me-2"></i>';
      const gained = u.gained > 0 ? ' <small class="text-success fw-bold">+' + u.gained + "</small>" : "";
      html += '<tr class="user-row ' + (u.me ? "row-me" : "") + '" data-id="' + u.id + '" style="cursor:pointer"><td class="ps-4">' + medal + '</td><td class="text-center small fw-bold">' + move +
        "</td><td>" + av + '<span class="fw-semibold">' + esc(u.username) + "</span>" +
        (u.me ? ' <span class="badge wc-userchip ms-2">' + esc(t("lb.you")) + "</span>" : "") + '</td><td class="text-end pe-4 fw-bold text-accent">' + u.totalPoints + gained + "</td></tr>";
    });
    setBody(html + "</tbody></table></div></div>");
    document.querySelectorAll(".user-row, .podium-place").forEach((r) =>
      r.addEventListener("click", () => openUserProfile(r.dataset.id)));
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
    checkUpdate();
    if (API.token()) checkAdmin().then(() => go("fixtures")); else renderLogin();
  }
  document.addEventListener("deviceready", start, false);
  setTimeout(start, 1200);
})();
