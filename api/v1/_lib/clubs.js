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
  }
};

export function getClubConfig(slug) {
  return CLUBS[slug] || null;
}
