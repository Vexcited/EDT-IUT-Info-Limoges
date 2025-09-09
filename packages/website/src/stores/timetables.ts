import { createStore } from "solid-js/store";

import localforage from "localforage";
import { DateTime } from "luxon";

import type { ApiTimetableMeta, ITimetable } from "~/types/api";
import { APIError, APIErrorType } from "~/utils/errors";

const makeYearSTR = (year: number) => `A${year}` as "A1" | "A2" | "A3";
const makeWeekSTR = (week_number: number) => `S${week_number}` as const;

interface TimetableMeta {
  /** Timestamp of the last time that timetable was fetched from server. */
  last_fetch: number
  timetables: ApiTimetableMeta["data"]
}

const [temporaryTimetablesStore, setTemporaryTimetablesStore] = createStore<Record<"A1" | "A2" | "A3", Record<`S${number}`, ITimetable | undefined>>>({
  A1: {},
  A2: {},
  A3: {}
});

/**
 * Simplified getter for the temporary store.
 *
 * @param year
 * @param week_number
 */
export const getTemporaryTimetablesStore = (year: number, week_number: number): ITimetable | null => {
  // When we're loading, so current week is `-1` and next week may be `-1 | 0`, we don't want to show anything.
  if (week_number < 1) null;
  return temporaryTimetablesStore[makeYearSTR(year)][makeWeekSTR(week_number)] ?? null;
};

const getTimetableMetaStore = async (year: number, forceRefreshAll = false): Promise<TimetableMeta> => {
  const key = "timetables-meta-" + makeYearSTR(year);
  const metadataInStorage = localStorage.getItem(key);

  const renew = async () => {
    const response = await fetch(`/api/timetables/${makeYearSTR(year)}`);
    const { data: timetables } = await response.json() as ApiTimetableMeta;

    const meta = {
      last_fetch: Date.now(),
      timetables
    };

    localStorage.setItem(key, JSON.stringify(meta));
    return meta;
  };

  /** Used in case we're using `forceRefreshAll` while being offline. */
  let stored_meta: TimetableMeta | undefined;

  if (metadataInStorage) {
    try {
      stored_meta = JSON.parse(metadataInStorage) as TimetableMeta;

      const now = Date.now();
      const diff = now - stored_meta.last_fetch;

      // is not older than four hour (renew every 12 hours)
      if (diff < 1000 * 60 * 60 * 12) {
        // if we don't force refresh all, we can return the cache.
        if (!forceRefreshAll) {
          return stored_meta;
        }
      }
      else {
        try {
          return renew();
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
    return renew();
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
};

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
  try {
    const response = await fetch("/api/timetable/" + makeYearSTR(year) + "/" + week_number.toString());
    if (response.status === 404) throw new APIError(APIErrorType.NOT_FOUND);

    const { data: timetable } = await response.json() as { data: ITimetable };
    await getTimetableStore(makeYearSTR(year)).setItem<ITimetable & { last_fetch: number }>(
      makeWeekSTR(week_number), { ...timetable, last_fetch: Date.now() }
    );

    // TODO: update data in meta store.
    return timetable;
  }
  catch (error) {
    if (error instanceof APIError && error.type === APIErrorType.NOT_FOUND) {
      throw error;
    }

    throw new APIError(APIErrorType.NO_CACHE);
  }
};

/**
 * Refreshes the `temporaryTimetablesStore` store for a given week number.
 * This value will then be reactive in the views that use it,
 * and can be refreshed in background without having to wait
 * until the end of the request - if any was done.
 *
 * @param year - ex.: `1`
 * @param week_number - ex.: `12`
 */
export const refreshTimetableForWeekNumber = async (year: number, week_number: number): Promise<void> => {
  const stored_timetable = await getTimetableStore(makeYearSTR(year)).getItem<ITimetable & {
    last_fetch: number
  }>(makeWeekSTR(week_number));

  if (stored_timetable) {
    // Store the cached value in the temporary store
    // to directly show it in the user interface.
    setTemporaryTimetablesStore(makeYearSTR(year), makeWeekSTR(week_number), stored_timetable);

    const now = Date.now();
    const diff = now - stored_timetable.last_fetch;

    // It's not "outdated" (renew every hours), we keep it like that.
    if (diff < 1000 * 60 * 60) {
      return;
    }
  }

  try {
    // We don't have a cache, or it's outdated.
    // We'll try to fetch it from the server.
    const timetable = await fetchTimetableWithoutCache(year, week_number);
    setTemporaryTimetablesStore(makeYearSTR(year), makeWeekSTR(week_number), timetable);
  }
  catch (error) {
    if (error instanceof APIError) {
      // We have an outdated cache but no connection, so we'll just stay with the outdated cache.
      // It's better than nothing.
      if (error.type === APIErrorType.NO_CACHE && stored_timetable) return;
    }

    throw error;
  }
};

export const resetAppCache = async (): Promise<void> => {
  for (const year of [1, 2, 3]) {
    await getTimetableStore(`A${year}`).clear();
    localStorage.removeItem("timetables-meta-" + year);
  }
};
