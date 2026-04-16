const select = document.getElementById("themeSelect");

// ALLE Themes hier rein (wichtig!)
const themes = ["theme-dark", "theme-white"];

// Theme anwenden
function applyTheme(theme) {
  // alle entfernen
  document.documentElement.classList.remove(...themes);

  // neues setzen
  document.documentElement.classList.add("theme-" + theme);
}

// Init
(function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";

  applyTheme(savedTheme);

  if (select) {
    select.value = savedTheme;
  }
})();

// Change Event
if (select) {
  select.addEventListener("change", (e) => {
    const theme = e.target.value;

    applyTheme(theme);
    localStorage.setItem("theme", theme);
  });
}