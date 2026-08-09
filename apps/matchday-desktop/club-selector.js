
async function persistClubToNativeShell(slug) {
  try {
    if (window.matchdayWindows?.setSelectedClub) {
      await window.matchdayWindows.setSelectedClub(slug);
    }
  } catch (error) {
    console.warn("Could not persist selected club to native shell:", error);
  }
}

const MATCHDAY_SELECTED_CLUB_KEY = "matchday-desktop:selected-club:v1";

async function fetchSupportedClubs() {
  const base = String(window.MATCHDAY_CONFIG?.apiBaseUrl || "").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/v1/clubs`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load supported clubs (${response.status})`);
  }

  const payload = await response.json();
  return payload.clubs || [];
}

function requestedClubSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("club");
}

function storedClubSlug() {
  try {
    return localStorage.getItem(MATCHDAY_SELECTED_CLUB_KEY);
  } catch {
    return null;
  }
}

function storeClubSlug(slug) {
  try {
    localStorage.setItem(MATCHDAY_SELECTED_CLUB_KEY, slug);
  } catch {
    // Storage failure should not prevent the app from running.
  }
}

function clearClubSelection() {
  try {
    localStorage.removeItem(MATCHDAY_SELECTED_CLUB_KEY);
  } catch {
    // Ignore storage errors.
  }

  window.location.href = window.location.pathname;
}

async function selectClub(club) {
  window.MATCHDAY_CONFIG.club = club.slug;
  window.MATCHDAY_CONFIG.theme = club.themeKey;
  storeClubSlug(club.slug);
  await persistClubToNativeShell(club.slug);

  const selector = document.getElementById("clubSelector");
  const appShell = document.getElementById("appShell");

  if (selector) selector.hidden = true;
  if (appShell) appShell.hidden = false;
}

async function resolveClubSelection() {
  const clubs = await fetchSupportedClubs();

  const requested = requestedClubSlug();
  const stored = storedClubSlug();
  const desired = requested || stored;

  if (desired) {
    const match = clubs.find(club => club.slug === desired);

    if (match) {
      await selectClub(match);
      return match;
    }
  }

  renderClubSelector(clubs);
  return null;
}

function renderClubSelector(clubs) {
  const selector = document.getElementById("clubSelector");
  const list = document.getElementById("clubSelectorList");
  const appShell = document.getElementById("appShell");

  if (!selector || !list) return;

  if (appShell) appShell.hidden = true;
  selector.hidden = false;
  list.innerHTML = "";

  clubs.forEach(club => {
    const button = document.createElement("button");
    button.className = "club-choice";
    button.type = "button";
    button.innerHTML = `
      <span class="club-choice-tla">${club.tla || ""}</span>
      <span class="club-choice-name">${club.displayName}</span>
    `;

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await selectClub(club);
        await initialiseSelectedClub();
      } finally {
        button.disabled = false;
      }
    });

    list.appendChild(button);
  });
}
