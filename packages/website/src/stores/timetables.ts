import localforage from "localforage";
import type { ApiTimetableMeta, ITimetable } from "~/types/api";
import { APIError, APIErrorType } from "~/utils/errors";

const makeYearSTR = (year: number): string => `A${year}`;
const makeWeekSTR = (week_number: number): string => `S${week_number}`;

interface TimetableMeta {
  /** Timestamp of the last time that timetable was fetched from server. */
  last_fetch: number
  timetables: ApiTimetableMeta["data"]
}

/** @param year - Example: "A1" */
const getTimetableMetaStore = async (year: number, forceRefreshAll = false): Promise<TimetableMeta> => {
  const key = "timetables-meta-" + makeYearSTR(year);
  const metasInStorage = localStorage.getItem(key);
  let meta: TimetableMeta | undefined;

  if (metasInStorage) {
    try {
      const raw_meta = JSON.parse(metasInStorage) as TimetableMeta;

      const now = Date.now();
      const diff = now - raw_meta.last_fetch;

      // is not older than four hour (renew every 12 hours)
      if (forceRefreshAll || diff < 1000 * 60 * 60 * 12) {
        // Debug.
        console.info("[getTimetableMetaStore]: retreieved cache from store.");

        meta = raw_meta;
      }
    } catch { /** No-op since non-parsable. */ }
  }

  if (!meta) {
    try {
      console.info("[getTimetableMetaStore]: empty store : fetching all timetables...");

      const response = await fetch(`/api/timetables/${makeYearSTR(year)}`);
      const { data: timetables } = await response.json() as ApiTimetableMeta;

      meta = {
        last_fetch: Date.now(),
        timetables
      };

      localStorage.setItem(key, JSON.stringify(meta));
      console.info("[getTimetableMetaStore]: empty store : fetching done, replaced in localStorage.");
    }
    // No internet connection, throw a cache error.
    catch {
      throw new APIError(APIErrorType.NO_CACHE);
    }
  }

  return meta;
}

export const getTodaysWeekNumber = async (year: number, forceRefreshMetas = false): Promise<number> => {
  const today = new Date();

  // if we're on sunday, skip to next week.
  if (today.getDay() === 0) {
    today.setDate(today.getDate() + 1);
  }

  const metas = await getTimetableMetaStore(year, forceRefreshMetas);

  const timetable_meta = metas.timetables.find(
    meta => {
      const start_date = new Date(meta.start_date);
      const end_date = new Date(meta.end_date);

      return today >= start_date && today < end_date;
    }
  );

  // when it's not found there's two possibilities:
  // - we're in vacation (so latest timetable is the last one)
  // - outdated cache (so we need to fetch the entire list again)
  if (!timetable_meta) {
    // try to see if we're in outdated cache.
    if (!forceRefreshMetas) {
      return getTodaysWeekNumber(year, true);
    }

    throw new APIError(APIErrorType.NOT_FOUND);
  }

  return timetable_meta.week_number;
};

/** @param year - Example: "A1" */
const getTimetableStore = (year: string) => localforage.createInstance({
  name: "timetables",
  storeName: year
});

/**
 * Fetches the timetable and puts it in cache.
 */
const fetchTimetableWithoutCache = async (year: number, week_number: number): Promise<ITimetable> => {
  const response = await fetch("/api/timetable/" + makeYearSTR(year) + "/" + week_number.toString());
  if (response.status === 404) throw new APIError(APIErrorType.NOT_FOUND);

  const { data: timetable } = await response.json() as { data: ITimetable };
  await getTimetableStore(makeYearSTR(year)).setItem<ITimetable & { last_fetch: number }>(
    makeWeekSTR(week_number), { ...timetable, last_fetch: Date.now() }
  );

  // NOTE: maybe update data in meta store ?
  return timetable;
};

export const getTimetableForWeekNumber = async (year: number, week_number: number): Promise<ITimetable> => {
  const stored_timetable = await getTimetableStore(makeYearSTR(year)).getItem<ITimetable & {
    last_fetch: number
  }>(makeWeekSTR(week_number));

  if (stored_timetable) {
    const now = Date.now();
    const diff = now - stored_timetable.last_fetch;

    // is not older than an hour (renew every hours)
    if (diff < 1000 * 60 * 60) {
      // Debug.
      console.info(`[CACHE][${year}]:`, week_number);
      return stored_timetable;
    }
  }

  try {
    const timetable = await fetchTimetableWithoutCache(year, week_number);
    return timetable;
  }
  // No connection and no cache,
  // there's nothing we can do.
  catch (error) {
    if (error instanceof APIError && error.type === APIErrorType.NOT_FOUND) {
      throw error;
    }

    throw new APIError(APIErrorType.NO_CACHE);
  }
};

export const deleteTimeTableForWeekNumber = async (year: number, week_number: number): Promise<void> => {
  await getTimetableStore(makeYearSTR(year)).removeItem(makeWeekSTR(week_number));
}

export const resetAppCache = async (): Promise<void> => {
  for (const year of [1, 2, 3]) {
    await getTimetableStore(`A${year}`).clear();
    localStorage.removeItem("timetables-meta-" + year);
  }

  [ // Reset all preferences.
    "user_customization",
    "year",
    "main_group",
    "sub_group",
  ].forEach(key => localStorage.removeItem(key));
};
