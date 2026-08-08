export const CLUBS = {
  "coventry-city": {
    slug: "coventry-city",
    providerTeamId: 1076,
    displayName: "Coventry City",
    shortName: "Coventry",
    tla: "COV",
    competitionCode: "PL",
    seasonStartYear: 2026,
    themeKey: "sky-blues"
  },

  "arsenal": {
    slug: "arsenal",
    providerTeamId: 57,
    displayName: "Arsenal",
    shortName: "Arsenal",
    tla: "ARS",
    competitionCode: "PL",
    seasonStartYear: 2026,
    themeKey: "classic-arsenal"
  }
};

export function getClubConfig(slug) {
  return CLUBS[slug] || null;
}
