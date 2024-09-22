import { describe, test, expect } from "@jest/globals";

import { YEARS } from "../src/downloader/constants";
import { getTimetableEntries, getLatestTimetableEntry } from "../src/downloader";
import { EDT_ENDPOINT_URL } from "../src/downloader/constants";

describe("downloader", () => {
  test("getTimetableEntries", async () => {
    const entries = await getTimetableEntries(YEARS.A1);
    expect(entries.length).toBeGreaterThan(0);
  });

  test("getLatestTimetableEntry", async () => {
    const entry = await getLatestTimetableEntry(YEARS.A1);
    expect(entry).toBeDefined();

    // Check study year from entry.
    expect(entry.from_year).toBe(YEARS.A1);

    // Check the validity of the last_updated date.
    expect(entry.last_updated.year).toBe(new Date().getFullYear());

    // Check week number.
    expect(entry.week_number).toBeGreaterThan(0);
    
    // Check link format.
    expect(entry.link.startsWith(`${EDT_ENDPOINT_URL}/${YEARS.A1}/`)).toBe(true);
    expect(entry.link.endsWith(".pdf")).toBe(true);
  });

  test("getLatestTimetableEntry - invalid year", async () => {
    // We expect the TS error since we're passing an invalid year. 
    // @ts-expect-error
    await expect(getLatestTimetableEntry("A0")).rejects.toThrow();
  });
});
