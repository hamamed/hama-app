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
    userProfile: (id) => call("/user/" + id),
    community: () => call("/community"),
    vote: (pollId, choice) => call("/vote", { method: "POST", body: { pollId, choice } }),
    me: () => call("/me"),
    posts: (sort) => call("/community/posts" + (sort ? "?sort=" + sort : "")),
    addPost: (body) => call("/community/posts", { method: "POST", body: { body } }),
    editPost: (id, body) => call("/community/posts/" + id + "/edit", { method: "POST", body: { body } }),
    reportPost: (id) => call("/community/posts/" + id + "/report", { method: "POST" }),
    votePost: (id, value) => call("/community/posts/" + id + "/vote", { method: "POST", body: { value } }),
    addPostComment: (id, body, parentId) => call("/community/posts/" + id + "/comment", { method: "POST", body: { body, parentId } }),
    reactPost: (id, emoji) => call("/community/posts/" + id + "/react", { method: "POST", body: { emoji } }),
    delPost: (id) => call("/community/posts/" + id + "/delete", { method: "POST" }),
    delComment: (id) => call("/community/comments/" + id + "/delete", { method: "POST" }),
    appVersion: () => call("/app-version"),
    admin: {
      overview: () => call("/admin/overview"),
      addMatch: (teamA, teamB, kickoffTime) => call("/admin/match", { method: "POST", body: { teamA, teamB, kickoffTime } }),
      result: (id, a, b) => call("/admin/result/" + id, { method: "POST", body: { a, b } }),
      live: (id, a, b) => call("/admin/live/" + id, { method: "POST", body: { a, b } }),
      delMatch: (id) => call("/admin/delete/" + id, { method: "POST" }),
      importFixtures: () => call("/admin/import", { method: "POST" }),
      champion: (champion) => call("/admin/champion", { method: "POST", body: { champion } }),
      prediction: (userId, matchId, scoreA, scoreB, points) => call("/admin/prediction", { method: "POST", body: { userId, matchId, scoreA, scoreB, points } }),
      announce: (message) => call("/admin/announcement", { method: "POST", body: { message } }),
      announceToggle: (id) => call("/admin/announcement/" + id + "/toggle", { method: "POST" }),
      announceDelete: (id) => call("/admin/announcement/" + id + "/delete", { method: "POST" }),
      poll: (question) => call("/admin/poll", { method: "POST", body: { question } }),
      pollEdit: (id, question) => call("/admin/poll/" + id + "/edit", { method: "POST", body: { question } }),
      pollToggle: (id) => call("/admin/poll/" + id + "/toggle", { method: "POST" }),
      pollDelete: (id) => call("/admin/poll/" + id + "/delete", { method: "POST" }),
      userRename: (id, username) => call("/admin/users/rename/" + id, { method: "POST", body: { username } }),
      userReset: (id) => call("/admin/users/reset/" + id, { method: "POST" }),
      userResetPin: (id) => call("/admin/users/resetpin/" + id, { method: "POST" }),
      userToggleAdmin: (id) => call("/admin/users/admin/" + id, { method: "POST" }),
      userDelete: (id) => call("/admin/users/delete/" + id, { method: "POST" }),
      userPreds: (id) => call("/admin/users/" + id + "/predictions"),
      userPredDelete: (userId, matchId) => call("/admin/users/" + userId + "/predictions/" + matchId + "/delete", { method: "POST" }),
      userPredEdit: (userId, matchId, scoreA, scoreB, points) => call("/admin/users/" + userId + "/predictions/" + matchId + "/edit", { method: "POST", body: { scoreA, scoreB, points } }),
    },
    setUsername: (username) => call("/username", { method: "POST", body: { username } }),
    setAvatar: (avatar) => call("/avatar", { method: "POST", body: { avatar } }),
    updateUser: (patch) => {
      const u = Object.assign(JSON.parse(localStorage.getItem("wc_user") || "{}"), patch);
      localStorage.setItem("wc_user", JSON.stringify(u));
    },
  };
})();
