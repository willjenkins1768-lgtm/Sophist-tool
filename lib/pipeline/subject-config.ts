/**
 * Subject-level config: keywords for media filtering, extensible per subject.
 * Add entries here when you add new subjects so media collection stays accurate and complete.
 */

/** Keywords used to match RSS items to a subject (title + description). Case-insensitive substring match. */
export const SUBJECT_KEYWORDS: Record<string, string[]> = {
  small_boats: [
    "small boat",
    "small boats",
    "channel crossing",
    "channel crossings",
    "migrant",
    "migrants",
    "asylum",
    "refugee",
    "border",
    "illegal migration",
    "home office",
    "suella",
    "rishi",
    "rwanda",
    "deterrence",
    "dover",
    "calais",
    // Legal/capacity framing
    "backlog",
    "ECHR",
    "human rights act",
    "legal challenge",
    "court",
    "deportation",
  ],
};

/** Search query for News API (q=). Used when NEWS_API_KEY is set; keeps results relevant to the subject. */
export const SUBJECT_SEARCH_QUERY: Record<string, string> = {
  small_boats:
    "small boats OR channel crossings OR asylum seekers UK OR illegal migration UK OR Rwanda deportation OR migrant boats",
};

export const DEFAULT_SUBJECT_SEARCH_QUERY = SUBJECT_SEARCH_QUERY.small_boats;

/** Default keywords if subject has no config (avoids empty match-all). */
export const DEFAULT_SUBJECT_KEYWORDS: string[] = SUBJECT_KEYWORDS.small_boats;

export function getSubjectKeywords(subjectId: string): string[] {
  return SUBJECT_KEYWORDS[subjectId] ?? DEFAULT_SUBJECT_KEYWORDS;
}

export function getSubjectSearchQuery(subjectId: string): string {
  return SUBJECT_SEARCH_QUERY[subjectId] ?? DEFAULT_SUBJECT_SEARCH_QUERY;
}
