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
    // Only force a re-login on 401 for authenticated requests (not the login call).
    if (res.status === 401 && tk) { logout(); location.reload(); throw new Error("unauthorized"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "error"), { status: res.status, data });
    return data;
  }

  return {
    token, user, setSession, logout,
    login: (username, pin) => call("/login", { method: "POST", body: pin != null ? { username, pin } : { username } }),
    matches: () => call("/matches"),
    predict: (matchId, scoreA, scoreB) => call("/predict", { method: "POST", body: { matchId, scoreA, scoreB } }),
    leaderboard: () => call("/leaderboard"),
    standings: () => call("/standings"),
    profile: () => call("/profile"),
    champion: (champion) => call("/champion", { method: "POST", body: { champion } }),
    matchPreds: (id) => call("/match/" + id + "/predictions"),
    community: () => call("/community"),
    vote: (pollId, choice) => call("/vote", { method: "POST", body: { pollId, choice } }),
    appVersion: () => call("/app-version"),
    setUsername: (username) => call("/username", { method: "POST", body: { username } }),
    setAvatar: (avatar) => call("/avatar", { method: "POST", body: { avatar } }),
    updateUser: (patch) => {
      const u = Object.assign(JSON.parse(localStorage.getItem("wc_user") || "{}"), patch);
      localStorage.setItem("wc_user", JSON.stringify(u));
    },
  };
})();
