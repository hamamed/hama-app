/* API wrapper — talks to the same server as the website. */
window.API = (function () {
  // Point this at your deployed server.
  const BASE = "https://koydam.com/api";

  function token() { return localStorage.getItem("wc_token"); }
  function setSession(token, user) {
    localStorage.setItem("wc_token", token);
    localStorage.setItem("wc_user", JSON.stringify(user || {}));
  }
  function user() {
    try { return JSON.parse(localStorage.getItem("wc_user") || "null"); } catch { return null; }
  }
  function logout() {
    localStorage.removeItem("wc_token");
    localStorage.removeItem("wc_user");
  }

  async function call(path, opts = {}) {
    const sep = path.indexOf("?") >= 0 ? "&" : "?";
    const url = BASE + path + sep + "lang=" + I18N.lang();
    const headers = { "Content-Type": "application/json" };
    const tk = token();
    if (tk) headers["Authorization"] = "Bearer " + tk;
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) { logout(); location.reload(); throw new Error("unauthorized"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "error"), { status: res.status, data });
    return data;
  }

  return {
    token, user, setSession, logout,
    login: (username) => call("/login", { method: "POST", body: { username } }),
    matches: () => call("/matches"),
    predict: (matchId, scoreA, scoreB) => call("/predict", { method: "POST", body: { matchId, scoreA, scoreB } }),
    leaderboard: () => call("/leaderboard"),
    standings: () => call("/standings"),
    profile: () => call("/profile"),
    champion: (champion) => call("/champion", { method: "POST", body: { champion } }),
  };
})();
