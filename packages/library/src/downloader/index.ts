import { FTP_ENDPOINT_URL, YEARS } from "./constants.js";
import { TimetableEntry } from "./entry.js";

export const getTimetableEntries = async (from: YEARS): Promise<TimetableEntry[]> => {
  const response = await fetch(`${FTP_ENDPOINT_URL}/${from}`);
  const html = await response.text();

  const regex = /<td><a href="(.*)">(.*)<\/a><\/td><td align="right">(.*)\s<\/td>/g;
  const matches = html.matchAll(regex);

  const entries: TimetableEntry[] = [];
  for (const match of matches) {
    const entry = new TimetableEntry(match[1], match[3].trim());
    entries.push(entry);
  }

  // Sort entries by week number.
  entries.sort((a, b) => a.week_number - b.week_number);
  return entries;
};

export const getLatestTimetableEntry = async (from: YEARS): Promise<TimetableEntry> => {
  const entries = await getTimetableEntries(from);
  // Since the entries are sorted by week number, the last one is the latest.
  return entries[entries.length - 1];
};
