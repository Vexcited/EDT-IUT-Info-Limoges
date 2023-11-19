import localforage from "localforage";
import { DateTime } from "luxon";

import type { ApiTimetableMeta, ITimetable } from "~/types/api";
import { APIError, APIErrorType } from "~/utils/errors";

const makeYearSTR = (year: number): string => `A${year}`;
const makeWeekSTR = (week_number: number): string => `S${week_number}`;

interface TimetableMeta {
  /** Timestamp of the last time that timetable was fetched from server. */
  last_fetch: number
  timetables: ApiTimetableMeta["data"]
}

const getTimetableMetaStore = async (year: number, forceRefreshAll = false): Promise<TimetableMeta> => {
  const key = "timetables-meta-" + makeYearSTR(year);
  const metasInStorage = localStorage.getItem(key);

  const renew = async () => {
    const response = await fetch(`/api/timetables/${makeYearSTR(year)}`);
    const { data: timetables } = await response.json() as ApiTimetableMeta;

    const meta = {
      last_fetch: Date.now(),
      timetables
    };

    localStorage.setItem(key, JSON.stringify(meta));
    return meta;
  }

  /** Used in case we're using `forceRefreshAll` while being offline. */
  let stored_meta: TimetableMeta | undefined;

  if (metasInStorage) {
    try {
      stored_meta = JSON.parse(metasInStorage) as TimetableMeta;

      const now = Date.now();
      const diff = now - stored_meta.last_fetch;

      // is not older than four hour (renew every 12 hours)
      if (diff < 1000 * 60 * 60 * 12) {
        // if we don't force refresh all, we can return the cache.
        if (!forceRefreshAll) {
          // Debug.
          console.info("[getTimetableMetaStore]: retreieved cache from store.");
          return stored_meta;
        }
      }
      else {
        // Debug.
        console.info("[getTimetableMetaStore]: cache is outdated, fetching again...");

        try {
          const renewed_meta = await renew();
          return renewed_meta;
        }
        catch {
          // No internet connection, return the old cache.
          return stored_meta;
        }
      }
    }
    catch { /** No-op since non-parsable. */ }
  }

  try {
    console.info("[getTimetableMetaStore]: cache is empty, fetching all timetables...");
    const meta = await renew();
    return meta;
  }
  catch {
    if (forceRefreshAll && stored_meta) {
      return stored_meta;
    }

    // No internet connection, throw a cache error.
    throw new APIError(APIErrorType.NO_CACHE);
  }
};

/**
 * used only when we're in vacation.
 */
export const getLatestWeekNumber = async (year: number): Promise<number> => {
  const metas = await getTimetableMetaStore(year);

  const last_timetable = metas.timetables[metas.timetables.length - 1];
  return last_timetable.week_number;
}

/**
 * Get the week number of the a given day.
 */
export const getDayWeekNumber = async (day: DateTime, year: number, forceRefreshMetas = false): Promise<number> => {
  const metas = await getTimetableMetaStore(year, forceRefreshMetas);

  const timetable_meta = metas.timetables.find(
    meta => {
      return meta.week_number_in_year === day.weekNumber;
    }
  );

  // when it's not found there's two possibilities:
  // - we're in vacation (so latest timetable is the last one)
  // - outdated cache (so we need to fetch the entire list again)
  if (!timetable_meta) {
    // try to see if we're in outdated cache.
    if (!forceRefreshMetas) {
      return getDayWeekNumber(day, year, true);
    }

    // we're in vacation, to be handled by the caller (main Page view).
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
  const renew = async () => {
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
  }

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

    try {
      const renewed_timetable = await renew();
      return renewed_timetable;
    }
    catch (error) {
      if (error instanceof APIError && error.type === APIErrorType.NO_CACHE) {
        return stored_timetable;
      }

      throw error;
    }
  }

  return renew();
};

export const deleteTimetableForWeekNumber = async (year: number, week_number: number): Promise<void> => {
  await getTimetableStore(makeYearSTR(year)).removeItem(makeWeekSTR(week_number));
}

export const resetAppCache = async (): Promise<void> => {
  for (const year of [1, 2, 3]) {
    await getTimetableStore(`A${year}`).clear();
    localStorage.removeItem("timetables-meta-" + year);
  }
};
