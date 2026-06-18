/* HAMA WC 2026 — Cordova app SPA */
(function () {
  const t = I18N.t;
  const app = () => document.getElementById("app");
  const LOCALE = { en: "en-GB", fr: "fr-FR", ar: "ar" };
  let countdownTimer = null;
  let liveTimer = null;

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function applyDir() {
    document.documentElement.dir = I18N.isRTL() ? "rtl" : "ltr";
    document.documentElement.lang = I18N.lang();
  }
  function toast(msg, ok) {
    let box = document.getElementById("toast");
    if (!box) { box = document.createElement("div"); box.id = "toast"; document.body.appendChild(box); }
    const el = document.createElement("div");
    el.className = "toast " + (ok ? "ok" : "err");
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

  // ---------- shell ----------
  function shell(activeTab, bodyHtml) {
    const tabs = [
      { id: "fixtures", icon: "fa-calendar-days", label: t("nav.fixtures") },
      { id: "groups", icon: "fa-table-cells-large", label: t("nav.groups") },
      { id: "ranks", icon: "fa-trophy", label: t("nav.ranks") },
      { id: "profile", icon: "fa-user", label: t("nav.profile") },
    ];
    app().innerHTML =
      '<div class="topbar"><img class="logo" src="img/logo.png" onerror="this.style.display=\'none\'"/>' +
      '<h1>' + esc(t("appName")) + '</h1><div class="spacer"></div></div>' +
      '<div class="screen fade-in" id="screen">' + bodyHtml + '</div>' +
      '<nav class="tabbar">' + tabs.map((x) =>
        '<button class="tab ' + (x.id === activeTab ? "active" : "") + '" data-tab="' + x.id + '">' +
        '<i class="fa-solid ' + x.icon + '"></i><span>' + esc(x.label) + '</span></button>').join("") +
      '</nav>';
    app().querySelectorAll(".tab").forEach((b) =>
      b.addEventListener("click", () => go(b.dataset.tab)));
  }
  function loadingBody() { return '<div class="empty"><i class="fa-solid fa-futbol fa-spin"></i>' + esc(t("loading")) + '</div>'; }

  // ---------- navigation ----------
  function go(tab) {
    clearTimers();
    const screens = { fixtures: renderFixtures, groups: renderGroups, ranks: renderRanks, profile: renderProfile };
    shell(tab, loadingBody());
    (screens[tab] || renderFixtures)();
  }

  // ---------- LOGIN ----------
  function renderLogin() {
    clearTimers();
    applyDir();
    app().innerHTML =
      '<div class="login-wrap">' +
      '<div class="langrow">' + I18N.LANGS.map((l) =>
        '<button class="btn btn-sm ' + (l.c === I18N.lang() ? "btn-accent" : "btn-ghost") + '" data-l="' + l.c + '">' + l.c.toUpperCase() + '</button>').join("") +
      '</div>' +
      '<img class="login-logo" src="img/logo.png" onerror="this.style.display=\'none\'"/>' +
      '<p class="center muted">' + esc(t("login.tagline")) + '</p>' +
      '<div class="card" style="padding:18px;margin-top:8px">' +
      '<input id="u" class="input" placeholder="' + esc(t("login.placeholder")) + '" autocomplete="off"/>' +
      '<button id="go" class="btn btn-accent" style="margin-top:12px">' + esc(t("login.play")) + ' <i class="fa-solid fa-arrow-right-long"></i></button>' +
      '</div><p class="center muted" style="margin-top:14px;font-size:.8rem">' + esc(t("login.hint")) + '</p></div>';

    app().querySelectorAll("[data-l]").forEach((b) =>
      b.addEventListener("click", () => { I18N.setLang(b.dataset.l); renderLogin(); }));
    const input = document.getElementById("u");
    const submit = async () => {
      const name = (input.value || "").trim();
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(name)) return toast(t("login.invalid"), false);
      try {
        const r = await API.login(name);
        API.setSession(r.token, r.user);
        go("fixtures");
      } catch (e) { toast(e.status === 400 ? t("login.invalid") : t("netErr"), false); }
    };
    document.getElementById("go").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  // ---------- FIXTURES ----------
  async function renderFixtures() {
    let data;
    try { data = await API.matches(); } catch { return failBody(); }
    const matches = data.matches || [];
    if (!matches.length) return setBody('<div class="empty"><i class="fa-solid fa-futbol"></i>' + esc(t("noFixtures")) + '</div>');

    // group by day
    const counts = {};
    matches.forEach((m) => { m._day = dayKey(m.kickoff); counts[m._day] = (counts[m._day] || 0) + 1; });
    const days = Object.keys(counts).sort();
    const today = dayKey(Date.now());
    let sel = counts[today] ? today : "all";

    const chip = (key, label, n) =>
      '<button class="chip" data-day="' + key + '"><span class="m">' + esc(label) + '</span><span class="s">' + n + " " + esc(n > 1 ? t("day.matches") : t("day.match")) + '</span></button>';
    const daysHtml = '<div class="days" id="days">' +
      chip("all", t("day.all"), matches.length) +
      days.map((k) => chip(k, dayLabel(k), counts[k])).join("") + '</div>';

    setBody('<h2 class="h2">' + esc(t("nav.fixtures")) + '</h2>' + daysHtml + '<div id="list"></div>');

    const list = document.getElementById("list");
    function paint() {
      const vis = matches.filter((m) => sel === "all" || m._day === sel);
      list.innerHTML = vis.map(matchCard).join("") || '<div class="empty">' + esc(t("noFixtures")) + '</div>';
      bindPredicts();
      document.querySelectorAll("#days .chip").forEach((c) =>
        c.classList.toggle("active", c.dataset.day === sel));
    }
    document.querySelectorAll("#days .chip").forEach((c) =>
      c.addEventListener("click", () => { sel = c.dataset.day; paint(); c.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }));
    paint();

    // live auto-refresh
    if (matches.some((m) => m.badge === "live")) {
      liveTimer = setInterval(() => { if (document.getElementById("days")) renderFixtures(); }, 45000);
    }
  }

  function badgeHtml(b, pts) {
    if (b === "completed") return '<span class="badge b-done"><i class="fa-solid fa-flag-checkered"></i> ' + esc(t("badge.completed")) + (pts != null ? " +" + pts : "") + '</span>';
    if (b === "live") return '<span class="badge b-live"><span class="live-dot"></span>' + esc(t("badge.live")) + '</span>';
    if (b === "locked") return '<span class="badge b-locked"><i class="fa-solid fa-lock"></i> ' + esc(t("badge.locked")) + '</span>';
    return '<span class="badge b-open"><i class="fa-solid fa-unlock"></i> ' + esc(t("badge.open")) + '</span>';
  }
  function teamCol(name, flag) {
    const f = flag ? '<img class="flag" src="' + esc(flag) + '"/>' : '<div class="flag" style="background:#eef1f5"></div>';
    return '<div class="team">' + f + '<div class="nm">' + esc(name) + '</div></div>';
  }
  function matchCard(m) {
    let mid;
    if (m.badge === "completed") mid = '<div class="score-final">' + m.actualA + " - " + m.actualB + '</div>';
    else if (m.badge === "live") mid = '<div class="score-live">' + (m.liveA != null ? m.liveA : 0) + " - " + (m.liveB != null ? m.liveB : 0) + '</div>';
    else mid = '<div class="vs">' + esc(t("vs")) + '</div>';

    let bottom = "";
    if (m.badge === "open") {
      bottom =
        '<div class="predrow"><input class="input score" type="number" min="0" max="99" data-a value="' + (m.pred ? m.pred.a : "") + '" placeholder="0"/>' +
        '<b>-</b><input class="input score" type="number" min="0" max="99" data-b value="' + (m.pred ? m.pred.b : "") + '" placeholder="0"/></div>' +
        '<button class="btn btn-accent predict-btn" data-id="' + m.id + '">' + esc(m.pred ? t("update") : t("save")) + '</button>';
    } else if (m.pred) {
      bottom = '<div class="center muted" style="font-size:.85rem">' + esc(t("yourPick")) + ': <b>' + m.pred.a + "-" + m.pred.b + '</b>' +
        (m.badge === "completed" ? ' · <span class="badge b-open">' + m.pred.pts + " " + esc(t("pts")) + '</span>' : "") + '</div>';
    }

    return '<div class="card match"><div class="match-top">' + badgeHtml(m.badge, m.badge === "completed" && m.pred ? m.pred.pts : null) +
      '<span class="muted" style="font-size:.78rem">' + esc(fmtTime(m.kickoff)) + '</span></div>' +
      '<div class="teams">' + teamCol(m.teamA, m.flagA) + mid + teamCol(m.teamB, m.flagB) + '</div>' + bottom + '</div>';
  }
  function bindPredicts() {
    document.querySelectorAll(".predict-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        const card = btn.closest(".match");
        const a = card.querySelector("[data-a]").value;
        const b = card.querySelector("[data-b]").value;
        if (a === "" || b === "") return toast(t("invalid"), false);
        btn.disabled = true;
        const orig = btn.textContent;
        try {
          await API.predict(btn.dataset.id, a, b);
          btn.textContent = t("saved");
          btn.classList.add("btn-saved");
          toast(t("saved"), true);
          setTimeout(() => { btn.textContent = t("update"); btn.classList.remove("btn-saved"); btn.disabled = false; }, 1400);
        } catch (e) {
          toast(e.status === 403 ? t("locked") : e.status === 400 ? t("invalid") : t("netErr"), false);
          btn.textContent = orig; btn.disabled = false;
        }
      });
    });
  }

  // ---------- GROUPS / STANDINGS ----------
  async function renderGroups() {
    let data;
    try { data = await API.standings(); } catch { return failBody(); }
    const groups = (data.groups || []).filter((g) => g.rows.length);
    if (!groups.length) return setBody('<h2 class="h2">' + esc(t("st.title")) + '</h2><div class="empty"><i class="fa-solid fa-table-list"></i>' + esc(t("st.none")) + '</div>');

    const head = '<tr><th>#</th><th>' + esc(t("st.team")) + '</th><th class="tnum">' + esc(t("st.p")) + '</th><th class="tnum">' + esc(t("st.w")) +
      '</th><th class="tnum">' + esc(t("st.d")) + '</th><th class="tnum">' + esc(t("st.l")) + '</th><th class="tnum">' + esc(t("st.gd")) + '</th><th class="tnum">' + esc(t("st.pts")) + '</th></tr>';
    function rowHtml(r, qualifyTop) {
      const cls = r.rank <= 2 && qualifyTop ? "qual" : (r.rank === 3 && qualifyTop ? "play" : "");
      const flag = r.flag ? '<img class="flag-mini" src="' + esc(r.flag) + '"/>' : "";
      return '<tr class="' + cls + '"><td><b>' + r.rank + '</b></td><td>' + flag + esc(r.team) + '</td>' +
        '<td class="tnum">' + r.played + '</td><td class="tnum">' + r.win + '</td><td class="tnum">' + r.draw + '</td>' +
        '<td class="tnum">' + r.lose + '</td><td class="tnum">' + (r.gd > 0 ? "+" + r.gd : r.gd) + '</td><td class="tnum"><b>' + r.points + '</b></td></tr>';
    }
    let html = '<h2 class="h2">' + esc(t("st.title")) + '</h2>';
    groups.forEach((g) => {
      html += '<div class="card" style="padding:12px;margin-bottom:12px"><b>' + esc(g.name) + '</b>' +
        '<table>' + head + g.rows.map((r) => rowHtml(r, true)).join("") + '</table></div>';
    });
    if (data.thirds && data.thirds.length) {
      html += '<div class="card" style="padding:12px"><b>' + esc(t("st.bestThirds")) + '</b><table>' + head +
        data.thirds.map((r) => rowHtml({ ...r, rank: r.thirdRank }, false)).join("") + '</table></div>';
    }
    setBody(html);
  }

  // ---------- RANKS ----------
  async function renderRanks() {
    let data;
    try { data = await API.leaderboard(); } catch { return failBody(); }
    const users = data.users || [];
    let html = '<h2 class="h2">' + esc(t("lb.title")) + '</h2>';
    if (!users.length) return setBody(html + '<div class="empty">' + esc(t("lb.empty")) + '</div>');
    html += '<div class="card" style="padding:6px 12px"><table><tr><th>' + esc(t("lb.rank")) + '</th><th>' + esc(t("lb.player")) +
      '</th><th class="tnum">' + esc(t("lb.points")) + '</th></tr>' +
      users.map((u) => {
        const medal = u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : '#' + u.rank;
        return '<tr class="' + (u.me ? "trow-me" : "") + '"><td>' + medal + '</td><td><b>' + esc(u.username) + '</b>' +
          (u.me ? ' <span class="badge b-open">' + esc(t("lb.you")) + '</span>' : "") + '</td><td class="tnum"><b>' + u.totalPoints + '</b></td></tr>';
      }).join("") + '</table></div>';
    setBody(html);
  }

  // ---------- PROFILE ----------
  async function renderProfile() {
    let d;
    try { d = await API.profile(); } catch { return failBody(); }

    // header
    let html = '<div class="card" style="padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
      '<div class="avatar"><i class="fa-solid fa-user-astronaut"></i></div>' +
      '<div style="flex:1;min-width:0"><div style="font-weight:900;font-size:1.2rem">' + esc(d.username) + '</div>' +
      '<div class="muted" style="font-size:.8rem">' + d.stats.totalPoints + ' ' + esc(t("pts")) + '</div></div>' +
      '<button id="logout" class="btn btn-sm btn-danger"><i class="fa-solid fa-right-from-bracket"></i></button></div>';

    // language switch
    html += '<div class="langrow" style="justify-content:flex-start;margin-bottom:14px">' + I18N.LANGS.map((l) =>
      '<button class="btn btn-sm ' + (l.c === I18N.lang() ? "btn-accent" : "btn-ghost") + '" data-l="' + l.c + '">' + esc(l.n) + '</button>').join("") + '</div>';

    // champion banner
    html += '<div class="card" style="padding:14px;margin-bottom:14px"><b><i class="fa-solid fa-crown" style="color:var(--gold)"></i> ' + esc(t("champ.title")) + '</b>';
    if (d.championLocked) {
      html += '<div style="margin-top:8px">' + esc(t("champ.locked")) + (d.championPick ? ': <b>' + esc(d.championLabel) + '</b>' : "") + '</div>';
    } else {
      html += '<div class="muted" style="font-size:.8rem;margin:6px 0">' + esc(t("champ.locksIn")) + ' <b id="cd">…</b></div>' +
        '<select id="champ" class="input" style="margin-bottom:8px"><option value="">' + esc(t("champ.choose")) + '</option>' +
        (d.teams || []).map((tm) => '<option value="' + esc(tm.value) + '"' + (d.championPick === tm.value ? " selected" : "") + '>' + esc(tm.label) + '</option>').join("") +
        '</select><button id="saveChamp" class="btn btn-accent">' + esc(t("champ.save")) + '</button>';
    }
    if (d.actualChampion) {
      const ok = d.championPick && d.championPick === d.actualChampion;
      html += '<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">' + esc(t("champ.actual")) + ' <b>' + esc(d.actualChampionLabel) + '</b> ' +
        (d.championPick ? '<span class="badge ' + (ok ? "b-done" : "b-locked") + '">' + esc(ok ? t("champ.correct") : t("champ.wrong")) + '</span>' : "") + '</div>';
    }
    html += '</div>';

    // stats
    const s = d.stats;
    html += '<div class="stats">' +
      statCard(s.totalPoints, t("stat.totalPoints")) +
      statCard(s.exact, t("stat.exact")) +
      statCard(s.outcome, t("stat.outcomes")) +
      statCard(s.hitRate + "%", t("stat.hitRate")) + '</div>';

    // history
    html += '<b>' + esc(t("hist.title")) + '</b>';
    if (!d.history.length) html += '<div class="empty">' + esc(t("hist.none")) + '</div>';
    else html += '<div class="card" style="padding:6px 12px;margin-top:8px"><table>' +
      d.history.map((h) =>
        '<tr><td>' + esc(h.teamA) + ' <span class="muted">' + esc(t("vs")) + '</span> ' + esc(h.teamB) + '</td>' +
        '<td class="tnum"><b>' + esc(h.pred) + '</b></td>' +
        '<td class="tnum">' + (h.result ? esc(h.result) : "—") + '</td>' +
        '<td class="tnum">' + (h.points != null ? "<b>" + h.points + "</b>" : "·") + '</td></tr>').join("") + '</table></div>';

    setBody(html);

    document.getElementById("logout").addEventListener("click", () => { API.logout(); renderLogin(); });
    document.querySelectorAll("[data-l]").forEach((b) =>
      b.addEventListener("click", () => { I18N.setLang(b.dataset.l); applyDir(); go("profile"); }));

    const saveBtn = document.getElementById("saveChamp");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const pick = document.getElementById("champ").value;
        if (!pick) return;
        try { await API.champion(pick); toast(t("saved"), true); go("profile"); }
        catch (e) { toast(e.status === 403 ? t("champ.locked") : t("netErr"), false); }
      });
    }
    // countdown
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
  function statCard(v, l) { return '<div class="card stat"><div class="v" style="color:var(--accent)">' + esc(v) + '</div><div class="l">' + esc(l) + '</div></div>'; }

  // ---------- shared ----------
  function setBody(html) { const s = document.getElementById("screen"); if (s) { s.innerHTML = html; s.classList.remove("fade-in"); void s.offsetWidth; s.classList.add("fade-in"); } }
  function failBody() { setBody('<div class="empty"><i class="fa-solid fa-triangle-exclamation"></i>' + esc(t("netErr")) + '</div>'); }

  // ---------- boot ----------
  let started = false;
  function start() {
    if (started) return; started = true;
    applyDir();
    if (API.token()) go("fixtures"); else renderLogin();
  }
  document.addEventListener("deviceready", start, false);
  // Fallback for browser testing (no Cordova): start shortly after load.
  setTimeout(start, 1200);
})();
