let activeMatchDate = null;
let hasLoadedRealData = false;
let refreshTimer = null;

function teamName(team) {
  return team?.name || "";
}

function isCoventry(name) {
  return /coventry/i.test(name || "");
}

function setImage(id, src, fallback) {
  const el = document.getElementById(id);
  el.src = src || fallback || "";
}

function setDataStatus(text, state = "") {
  const el = document.getElementById("dataStatus");
  if (!el) return;

  el.textContent = text;
  el.className = "data-status";

  if (state) {
    el.classList.add(`is-${state}`);
  }
}

function renderEmptyResults(targetId, message) {
  const target = document.getElementById(targetId);
  target.innerHTML = "";

  const div = document.createElement("div");
  div.className = "result-empty";
  div.textContent = message;
  target.appendChild(div);
}

function renderResults(targetId, rows) {
  const target = document.getElementById(targetId);
  target.innerHTML = "";

  if (!rows || rows.length === 0) {
    renderEmptyResults(targetId, "Previous results unavailable");
    return;
  }

  rows.slice(0, 5).forEach(row => {
    const div = document.createElement("div");
    div.className = "result";

    div.innerHTML = `
      <span class="outcome ${row.outcome || ""}">
        ${row.outcome || "-"}
      </span>
      <span title="${row.competition || ""}">
        ${row.opponent?.name || ""}
      </span>
      <span class="score">
        ${row.teamScore ?? "-"}-${row.oppScore ?? "-"}
      </span>
    `;

    target.appendChild(div);
  });
}

function tableWindow(table, teamNameValue, radius = 6) {
  const idx = table.findIndex(r =>
    (r.team || "").toLowerCase() === teamNameValue.toLowerCase()
  );

  if (idx < 0) return table.slice(0, 13);

  return table.slice(
    Math.max(0, idx - radius),
    Math.min(table.length, idx + radius + 1)
  );
}

function renderTable(rows) {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "standings-unavailable";
    tr.innerHTML = `
      <td colspan="8">2026/27 standings not available yet</td>
    `;
    tbody.appendChild(tr);
    return;
  }

  tableWindow(rows, "Coventry City").forEach(row => {
    const tr = document.createElement("tr");

    if (isCoventry(row.team)) {
      tr.className = "coventry";
    }

    tr.innerHTML = `
      <td>${row.pos}</td>
      <td>${row.team}</td>
      <td>${row.p}</td>
      <td>${row.w}</td>
      <td>${row.d}</td>
      <td>${row.l}</td>
      <td>${row.gd > 0 ? "+" : ""}${row.gd}</td>
      <td>${row.pts}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderNextThree(fixtures) {
  const panel = document.getElementById("nextThreePanel");
  const target = document.getElementById("nextThreeFixtures");

  if (!panel || !target) return;

  target.innerHTML = "";

  if (!fixtures || fixtures.length === 0) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "";

  fixtures.slice(0, 3).forEach(match => {
    const cityHome = isCoventry(teamName(match.homeTeam));
    const opponent = cityHome ? match.awayTeam : match.homeTeam;
    const date = new Date(match.utcDate);

    const row = document.createElement("div");
    row.className = "next-fixture";

    const dateLabel = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short"
    }).toUpperCase();

    const crestSrc = isCoventry(teamName(opponent))
      ? "assets/coventry-city-crest.png"
      : (opponent?.crest || "");

    row.innerHTML = `
      <span class="next-fixture-date">${dateLabel}</span>
      <img
        class="next-fixture-crest"
        src="${crestSrc}"
        alt="${teamName(opponent)} crest"
      >
      <span class="next-fixture-opponent">${teamName(opponent)}</span>
      <span class="next-fixture-ha">${cityHome ? "HOME" : "AWAY"}</span>
    `;

    const crest = row.querySelector(".next-fixture-crest");
    if (crest && !crestSrc) {
      crest.style.visibility = "hidden";
    }

    target.appendChild(row);
  });
}

function setMatchStateClass(mode) {
  document.body.classList.remove(
    "state-normal",
    "state-matchday",
    "state-live",
    "state-full-time"
  );

  document.body.classList.add(`state-${(mode || "NORMAL").toLowerCase()}`);
}

function renderMatchState(data) {
  const mode = data.matchState || "NORMAL";
  const featured = data.featuredMatch || data.nextMatch;

  const title = document.getElementById("matchCardTitle");
  const label = document.getElementById("countdownLabel");
  const banner = document.getElementById("matchStateBanner");
  const stateText = document.getElementById("matchStateText");
  const scoreText = document.getElementById("matchScoreText");

  setMatchStateClass(mode);

  if (!title || !label || !banner || !stateText || !scoreText) return;

  banner.hidden = true;
  scoreText.textContent = "";

  if (mode === "LIVE") {
    title.textContent = "LIVE MATCH";
    label.textContent = "MATCH STATUS";
    banner.hidden = false;

    const minute =
      Number.isFinite(featured?.minute)
        ? `${featured.minute}'`
        : "LIVE";

    stateText.textContent = minute;

    if (
      Number.isFinite(featured?.homeScore) &&
      Number.isFinite(featured?.awayScore)
    ) {
      scoreText.textContent =
        `${featured.homeScore} – ${featured.awayScore}`;
    }

    return;
  }

  if (mode === "FULL_TIME") {
    title.textContent = "FULL TIME";
    label.textContent = "FINAL RESULT";
    banner.hidden = false;
    stateText.textContent = "FULL TIME";

    if (
      Number.isFinite(featured?.homeScore) &&
      Number.isFinite(featured?.awayScore)
    ) {
      scoreText.textContent =
        `${featured.homeScore} – ${featured.awayScore}`;
    }

    return;
  }

  if (mode === "MATCHDAY") {
    title.textContent = "MATCHDAY";
    label.textContent = "KICK-OFF IN";
    banner.hidden = false;
    stateText.textContent = "TODAY";
    return;
  }

  title.textContent = "NEXT MATCH";
  label.textContent = "NEXT MATCH IN";
}

function scheduleNextRefresh(seconds) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  const safeSeconds = Math.max(60, Number(seconds) || 3600);

  refreshTimer = setTimeout(() => {
    loadLiveData();
  }, safeSeconds * 1000);

  console.log(`Next dashboard refresh in ${safeSeconds} seconds`);
}

function renderDashboard(data) {
  hasLoadedRealData = true;

  const match = data.featuredMatch || data.nextMatch;
  activeMatchDate = new Date(match.utcDate);

  renderMatchState(data);

  const home = match.homeTeam;
  const away = match.awayTeam;

  document.getElementById("homeTeam").textContent = teamName(home);
  document.getElementById("awayTeam").textContent = teamName(away);

  // Always use the exact user-supplied Coventry crest locally.
  setImage(
    "homeCrest",
    isCoventry(teamName(home))
      ? "assets/coventry-city-crest.png"
      : home.crest,
    ""
  );

  setImage(
    "awayCrest",
    isCoventry(teamName(away))
      ? "assets/coventry-city-crest.png"
      : away.crest,
    ""
  );

  const localDate = new Date(match.utcDate);

  document.getElementById("matchDate").textContent =
    localDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });

  document.getElementById("matchTime").textContent =
    localDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    });

  document.getElementById("matchVenue").textContent =
    match.venue || "Venue TBC";

  const cityIsHome = isCoventry(teamName(home));
  const opponent = cityIsHome ? away : home;

  // Last 5 mirrors the featured fixture: HOME team left, AWAY team right.
  if (cityIsHome) {
    document.getElementById("cityFormTitle").textContent =
      "COVENTRY CITY";
    document.getElementById("oppFormTitle").textContent =
      teamName(opponent).toUpperCase();

    renderResults("cityResults", data.cityLast5 || []);
    renderResults("oppResults", data.opponentLast5 || []);
  } else {
    document.getElementById("cityFormTitle").textContent =
      teamName(opponent).toUpperCase();
    document.getElementById("oppFormTitle").textContent =
      "COVENTRY CITY";

    renderResults("cityResults", data.opponentLast5 || []);
    renderResults("oppResults", data.cityLast5 || []);
  }

  renderTable(data.standings || []);
  renderNextThree(data.nextThree || []);

  const warningCount = (data.warnings || []).length;

  if (data.testModeActive) {
    setDataStatus(`TEST MODE • ${data.matchState}`, "warning");
  } else {
    setDataStatus(
      warningCount
        ? `CLOUD DATA • ${warningCount} WARNING${warningCount === 1 ? "" : "S"}`
        : "CLOUD DATA",
      warningCount ? "warning" : "live"
    );
  }
}

function updateCountdown() {
  if (!activeMatchDate || Number.isNaN(activeMatchDate.getTime())) {
    ["days", "hours", "minutes", "seconds"].forEach(id => {
      document.getElementById(id).textContent = "--";
    });
    return;
  }

  const diff = Math.max(0, activeMatchDate - new Date());
  const totalSeconds = Math.floor(diff / 1000);

  document.getElementById("days").textContent =
    String(Math.floor(totalSeconds / 86400)).padStart(2, "0");

  document.getElementById("hours").textContent =
    String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");

  document.getElementById("minutes").textContent =
    String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");

  document.getElementById("seconds").textContent =
    String(totalSeconds % 60).padStart(2, "0");
}

function updateClock() {
  const now = new Date();

  document.getElementById("heroTime").textContent =
    now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

  document.getElementById("heroDate").textContent =
    now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).toUpperCase();
}

function initialiseLoadingState() {
  document.getElementById("homeTeam").textContent = "—";
  document.getElementById("awayTeam").textContent = "—";
  document.getElementById("matchDate").textContent = "Loading fixture…";
  document.getElementById("matchTime").textContent = "—";
  document.getElementById("matchVenue").textContent = "—";
  document.getElementById("homeCrest").style.visibility = "hidden";
  document.getElementById("awayCrest").style.visibility = "hidden";
  renderEmptyResults("cityResults", "Loading previous results…");
  renderEmptyResults("oppResults", "Loading previous results…");
  setDataStatus("CONNECTING…");
}


const MATCHDAY_CACHE_KEY = "matchday-desktop:last-dashboard:v1";

function saveDashboardCache(payload) {
  try {
    localStorage.setItem(
      MATCHDAY_CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        payload
      })
    );
  } catch (error) {
    console.warn("Unable to save dashboard cache:", error);
  }
}

function loadDashboardCache() {
  try {
    const raw = localStorage.getItem(MATCHDAY_CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached || !cached.payload || !cached.savedAt) return null;

    return cached;
  } catch (error) {
    console.warn("Unable to read dashboard cache:", error);
    return null;
  }
}

function cacheAgeLabel(savedAt) {
  const ageMs = Math.max(0, Date.now() - new Date(savedAt).getTime());
  const minutes = Math.floor(ageMs / 60000);

  if (minutes < 1) return "<1 MIN OLD";
  if (minutes < 60) return `${minutes} MIN OLD`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HR${hours === 1 ? "" : "S"} OLD`;

  const days = Math.floor(hours / 24);
  return `${days} DAY${days === 1 ? "" : "S"} OLD`;
}

function buildDashboardUrl() {
  const config = window.MATCHDAY_CONFIG || {};
  const base = String(config.apiBaseUrl || "").replace(/\/+$/, "");
  const club = config.club || "coventry-city";

  if (!base) {
    throw new Error("MATCHDAY_CONFIG.apiBaseUrl is not configured");
  }

  const url = new URL(
    `${base}/api/v1/clubs/${encodeURIComponent(club)}/dashboard`
  );

  if (config.testState) {
    url.searchParams.set("testState", config.testState);
    url.searchParams.set("homeScore", String(config.testHomeScore ?? 1));
    url.searchParams.set("awayScore", String(config.testAwayScore ?? 2));
    url.searchParams.set("minute", String(config.testMinute ?? 67));
  }

  return url.toString();
}

async function loadLiveData() {
  try {
    const response = await fetch(buildDashboardUrl(), {
      cache: "no-store"
    });

    const payload = await response.json();
    saveDashboardCache(payload);

    if (!response.ok) {
      throw new Error(
        payload.error || "Could not load live football data."
      );
    }

    document.getElementById("homeCrest").style.visibility = "visible";
    document.getElementById("awayCrest").style.visibility = "visible";

    renderDashboard(payload);

    if (payload.warnings?.length) {
      console.warn("Data warnings:", payload.warnings);
    }

    if (payload.diagnostics) {
      console.group("Stage 2.3d dashboard diagnostics");
      console.log("Upcoming fixtures:", payload.diagnostics.upcomingFixtures);
      console.log("City Last 5:", payload.diagnostics.cityLast5);
      console.log("Opponent Last 5:", payload.diagnostics.opponentLast5);
      console.log("Next 3 payload:", payload.nextThree || []);
      console.groupEnd();
    }

    console.log("Dashboard API:", buildDashboardUrl());
    console.log("Match state:", payload.matchState);
    scheduleNextRefresh(payload.refreshAfterSeconds);
  } catch (err) {
    console.error("Football data error:", err);

    if (!hasLoadedRealData) {
      document.getElementById("matchDate").textContent =
        "Football data unavailable";
      document.getElementById("matchTime").textContent = "—";
      document.getElementById("matchVenue").textContent =
        "Check internet / Matchday API connection";

      renderEmptyResults(
        "cityResults",
        "Results unavailable"
      );

      renderEmptyResults(
        "oppResults",
        "Results unavailable"
      );

      renderTable([]);
    }

    setDataStatus("DATA CONNECTION ERROR", "error");
    scheduleNextRefresh(300);
  }
}

initialiseLoadingState();
updateCountdown();
updateClock();
loadLiveData();

setInterval(updateCountdown, 1000);
setInterval(updateClock, 1000);

