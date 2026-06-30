"use strict";

(() => {
  const SESSION_KEY = "mapa_mundo_authenticated";
  const REMEMBER_KEY = "mapa_mundo_remember_device";
  const form = document.getElementById("loginForm");
  const remember = document.getElementById("rememberDevice");
  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");
  const logout = document.getElementById("logoutButton");

  if (localStorage.getItem(REMEMBER_KEY) === "true") {
    sessionStorage.setItem(SESSION_KEY, "true");
    if (loginView && appView) {
      loginView.hidden = true;
      appView.hidden = false;
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }
    if (remember) remember.checked = true;
  }

  form?.addEventListener("submit", () => {
    window.setTimeout(() => {
      if (sessionStorage.getItem(SESSION_KEY) === "true" && remember?.checked) {
        localStorage.setItem(REMEMBER_KEY, "true");
      } else if (!remember?.checked) {
        localStorage.removeItem(REMEMBER_KEY);
      }
    }, 0);
  });

  logout?.addEventListener("click", () => {
    localStorage.removeItem(REMEMBER_KEY);
  });
})();
