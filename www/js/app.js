/* HAMA WC 2026 — Cordova app. Renders the same markup/classes as the website. */
(function () {
  const t = I18N.t;
  const app = () => document.getElementById("app");
  const LOCALE = { en: "en-GB", fr: "fr-FR", ar: "ar" };
  let countdownTimer = null, liveTimer = null;

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
    app().innerHTML =
      '<nav class="navbar wc-navbar"><div class="container">' +
        '<a class="navbar-brand d-flex align-items-center" href="#"><img class="brand-logo" src="img/logo.png" onerror="this.style.display=\'none\'"/></a>' +
        '<div class="dropdown ms-auto"><a class="nav-link dropdown-toggle lang-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">' +
          '<i class="fa-solid fa-globe me-1"></i>' + I18N.lang().toUpperCase() + "</a>" +
          '<ul class="dropdown-menu dropdown-menu-end">' + langItems + "</ul></div>" +
        '<span class="badge wc-userchip ms-2"><i class="fa-solid fa-user me-1"></i>' + esc(u.username || "") + "</span>" +
      "</div></nav>" +
      '<div class="container py-4" id="screen">' + bodyHtml + "</div>" +
      '<nav class="bottom-nav">' + tabs.map((x) =>
        '<button class="bottom-nav-item ' + (x.id === activeTab ? "active" : "") + '" data-tab="' + x.id + '">' +
        '<i class="fa-solid ' + x.icon + '"></i><span>' + esc(x.label) + "</span></button>").join("") + "</nav>";

    app().querySelectorAll(".bottom-nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    app().querySelectorAll("[data-l]").forEach((b) =>
      b.addEventListener("click", (e) => { e.preventDefault(); I18N.setLang(b.dataset.l); applyDir(); go(activeTab); }));
  }
  function setBody(html) { const s = document.getElementById("screen"); if (s) s.innerHTML = html; }
  function loading() { return '<div class="text-center text-secondary py-5"><i class="fa-solid fa-futbol fa-spin fa-2x"></i></div>'; }
  function fail() { setBody('<div class="text-center text-secondary py-5"><i class="fa-solid fa-triangle-exclamation fa-2x mb-2 d-block"></i>' + esc(t("netErr")) + "</div>"); }

  function go(tab) {
    clearTimers();
    const map = { fixtures: renderFixtures, groups: renderGroups, ranks: renderRanks, profile: renderProfile };
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
        API.setSession(r.token, r.user); go("fixtures");
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
        if (r.token) { API.setSession(r.token, r.user); go("fixtures"); }
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

    const head = '<div class="mb-4"><h2 class="fw-bold mb-0"><i class="fa-solid fa-calendar-days text-accent me-2"></i>' + esc(t("nav.fixtures")) + "</h2>" +
      '<p class="text-secondary mb-0">' + esc(t("dash.sub")) + "</p></div>";

    if (!matches.length) return setBody(head + '<div class="text-center text-secondary py-5"><i class="fa-solid fa-futbol fa-2x mb-3 d-block"></i>' + esc(t("noFixtures")) + "</div>");

    const counts = {};
    matches.forEach((m) => { m._day = dayKey(m.kickoff); counts[m._day] = (counts[m._day] || 0) + 1; });
    const days = Object.keys(counts).sort();
    const today = dayKey(Date.now());
    let sel = counts[today] ? today : "all";

    const chip = (key, label, n) => '<button class="day-chip" data-day="' + key + '"><span class="day-chip-main">' + esc(label) +
      '</span><span class="day-chip-sub">' + n + " " + esc(n > 1 ? t("day.matches") : t("day.match")) + "</span></button>";
    const daysHtml = '<div class="day-filter mb-4" id="days">' + chip("all", t("day.all"), matches.length) +
      days.map((k) => chip(k, dayLabel(k), counts[k])).join("") + "</div>";

    setBody(head + daysHtml + '<div class="row g-3" id="list"></div>' + howHtml());

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

    if (matches.some((m) => m.badge === "live")) {
      liveTimer = setInterval(() => { if (document.getElementById("days")) renderFixtures(); }, 45000);
    }
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
        '<input type="number" name="a" min="0" max="99" class="form-control score-input text-center" value="' + (m.pred ? m.pred.a : "") + '" placeholder="0" required/>' +
        '<span class="fw-bold text-secondary">-</span>' +
        '<input type="number" name="b" min="0" max="99" class="form-control score-input text-center" value="' + (m.pred ? m.pred.b : "") + '" placeholder="0" required/></div>' +
        '<button class="btn btn-accent w-100 fw-semibold"><i class="fa-solid fa-floppy-disk me-1"></i>' + esc(m.pred ? t("update") : t("save")) + "</button></form>";
    } else {
      let pick = '<span class="text-secondary fst-italic"><i class="fa-solid fa-ban me-1"></i>' + esc(t("dash.noPrediction")) + "</span>";
      if (m.pred) {
        pick = '<span class="text-secondary">' + esc(t("yourPick")) + ":</span> <span class=\"fw-semibold\">" + m.pred.a + "-" + m.pred.b + "</span>" +
          (m.badge === "completed" ? ' <span class="badge wc-badge badge-open ms-1">' + m.pred.pts + " " + esc(t("pts")) + "</span>" : "");
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
      ["fa-check-double", "how.outcome"], ["fa-xmark", "how.wrong"], ["fa-crown", "how.champion"]];
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
        if (j.completed) { const b = p.pts === 2 ? "badge-done" : p.pts === 1 ? "badge-open" : "badge-locked"; pts = '<td class="text-end"><span class="badge wc-badge ' + b + '">' + (p.pts > 0 ? "+" : "") + p.pts + "</span></td>"; }
        const mine = p.username === me;
        h += '<tr class="' + (mine ? "row-me" : "") + '"><td class="text-secondary">' + (i + 1) + '</td><td class="fw-semibold">' + esc(p.username) +
          (mine ? ' <span class="badge wc-userchip ms-1">' + esc(t("lb.you")) + "</span>" : "") + '</td><td class="text-center fw-bold">' + p.a + " - " + p.b + "</td>" + pts + "</tr>";
      });
      body.innerHTML = h + "</tbody></table></div>";
    }).catch(() => { body.innerHTML = '<div class="text-center text-danger py-4">' + esc(t("netErr")) + "</div>"; });
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
    let html = head + '<div class="card wc-card border-0"><div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
      '<thead><tr><th class="ps-4" style="width:70px">' + esc(t("lb.rank")) + '</th><th style="width:54px" class="text-center"><i class="fa-solid fa-arrows-up-down"></i></th><th>' +
      esc(t("lb.player")) + '</th><th class="text-end pe-4">' + esc(t("lb.points")) + "</th></tr></thead><tbody>";
    users.forEach((u) => {
      const medal = u.rank === 1 ? '<i class="fa-solid fa-medal text-gold"></i>' : u.rank === 2 ? '<i class="fa-solid fa-medal text-silver"></i>' :
        u.rank === 3 ? '<i class="fa-solid fa-medal text-bronze"></i>' : '<span class="text-secondary">#' + u.rank + "</span>";
      const move = u.move > 0 ? '<span class="text-success"><i class="fa-solid fa-caret-up"></i> ' + u.move + "</span>" :
        u.move < 0 ? '<span class="text-danger"><i class="fa-solid fa-caret-down"></i> ' + -u.move + "</span>" :
        '<span class="text-secondary"><i class="fa-solid fa-minus"></i></span>';
      html += '<tr class="' + (u.me ? "row-me" : "") + '"><td class="ps-4">' + medal + '</td><td class="text-center small fw-bold">' + move +
        '</td><td><i class="fa-solid fa-user-circle text-secondary me-2"></i><span class="fw-semibold">' + esc(u.username) + "</span>" +
        (u.me ? ' <span class="badge wc-userchip ms-2">' + esc(t("lb.you")) + "</span>" : "") + '</td><td class="text-end pe-4 fw-bold text-accent">' + u.totalPoints + "</td></tr>";
    });
    setBody(html + "</tbody></table></div></div>");
  }

  // ---------- PROFILE ----------
  async function renderProfile() {
    let d; try { d = await API.profile(); } catch { return fail(); }
    const s = d.stats;

    let html = '<div class="d-flex flex-wrap align-items-center gap-3 mb-4">' +
      '<div class="profile-avatar"><i class="fa-solid fa-user-astronaut"></i></div>' +
      '<div class="me-auto"><h2 class="fw-bold mb-0">' + esc(d.username) + '</h2><p class="text-secondary mb-0">' + s.totalPoints + " " + esc(t("pts")) + "</p></div>" +
      '<a href="#" id="logout" class="btn btn-outline-danger btn-sm"><i class="fa-solid fa-right-from-bracket me-1"></i>' + esc(t("profile.logout")) + "</a></div>";

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
      stat("fa-bullseye", '<span class="text-gold">' + s.exact + "</span>", t("stat.exact"), t("stat.pts2")) +
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
          h.points === 2 ? '<span class="badge wc-badge badge-done">+2</span>' : h.points === 1 ? '<span class="badge wc-badge badge-open">+1</span>' : '<span class="badge wc-badge badge-locked">0</span>') + "</td></tr>").join("") +
      "</tbody></table></div></div>";

    setBody(html);

    document.getElementById("logout").addEventListener("click", (e) => { e.preventDefault(); API.logout(); renderLogin(); });
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

  // ---------- boot ----------
  let started = false;
  function start() {
    if (started) return; started = true;
    applyDir();
    if (API.token()) go("fixtures"); else renderLogin();
  }
  document.addEventListener("deviceready", start, false);
  setTimeout(start, 1200);
})();
