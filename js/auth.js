// Scotia Fieldsport Log — authentication
// Simple hardcoded login, no Firebase Auth needed

const Auth = (() => {
  const SESSION_KEY = 'sfl_user';

  function login(username, password) {
    const user = USERS.find(u =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password
    );
    if (!user) return null;
    const session = { username: user.username, initial: user.initial, displayName: user.displayName };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function currentUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function require() {
    const u = currentUser();
    if (!u) { window.location.reload(); return null; }
    return u;
  }

  return { login, logout, currentUser, require };
})();
