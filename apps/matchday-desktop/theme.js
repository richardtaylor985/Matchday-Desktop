async function loadMatchdayTheme() {
  const config = window.MATCHDAY_CONFIG || {};
  const themeKey = config.theme || "sky-blues";
  const response = await fetch(`themes/${themeKey}/theme.json`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Unable to load theme "${themeKey}"`);
  }

  const theme = await response.json();
  window.MATCHDAY_THEME = theme;

  if (theme.pageTitle) {
    document.title = theme.pageTitle;
  }

  const hero = document.querySelector(".hero");
  if (hero && theme.heroAriaLabel) {
    hero.setAttribute("aria-label", theme.heroAriaLabel);
  }

  const root = document.documentElement;
  const colors = theme.colors || {};

  const cssVars = {
    "--sky": colors.sky,
    "--sky-soft": colors.skySoft,
    "--muted": colors.muted,
    "--line": colors.line,
    "--theme-bg-top": colors.backgroundTop,
    "--theme-bg-bottom": colors.backgroundBottom,
    "--theme-panel-top": colors.panelTop,
    "--theme-panel-bottom": colors.panelBottom
  };

  Object.entries(cssVars).forEach(([name, value]) => {
    if (value) root.style.setProperty(name, value);
  });

  return theme;
}

function themeAsset(name, fallback = "") {
  return window.MATCHDAY_THEME?.assets?.[name] || fallback;
}
