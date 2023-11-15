import localforage from "localforage";
import type { ITimetable, ApiTimetable } from "~/types/api";
import { APIError, APIErrorType } from "./errors";
import { setCurrentWeek } from "~/stores/preferences";

const timetable_meta_store = localforage.createInstance({
  name: "timetables",
  storeName: "meta"
});

const key = (week_number: number, day: Date) => week_number.toString() + "-" + day.getFullYear()
const timetable_store = (year: number) => localforage.createInstance({
  name: "timetables",
  storeName: "A" + year
});

interface TimetableStore {
  data: ITimetable
  // last_update: number
  last_fetch: number
}

export const deleteAllStores = async (): Promise<void> => {
  for (const year of [1, 2, 3]) {
    await timetable_store(year).clear();
  }
};

export const deleteTimetableFromStore = async (week_number: number, year: number): Promise<void> => {
  await timetable_store(year).removeItem(key(week_number, new Date()));
};

/**
 * @see <https://stackoverflow.com/a/6117889>
 * @param d - The date we want to take the week number from. 
 * @returns - The week number of the given date.
 */
export const getWeekNumber = (d: Date) => {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((
    (
      (d.getTime() - yearStart.getTime()) / 86400000
    ) + 1
  ) / 7);

  return weekNo;
};

interface TimetableMetaStore {
  last_fetch: number;
  data: Array<{
    file_name: string
    last_updated: string
    week_number: number
    from_year: string
    link: string
  }>
}

export const listTimetablesOnline = async (year: number): Promise<TimetableMetaStore["data"]> => {
  const year_str = `A${year}`;
  const stored_list = await timetable_meta_store.getItem<TimetableMetaStore | null>(year_str);

  if (stored_list) {
    const now = Date.now();
    const diff = now - stored_list.last_fetch;

    // older than half an hour
    if (diff < 3_600_000 / 2) {
      return stored_list.data;
    }
  }

  try {
    const response = await fetch("/api/list/" + year_str);
    const json = await response.json() as {
      success: true,
      data: TimetableMetaStore["data"]
    };

    await timetable_meta_store.setItem<TimetableMetaStore>(year_str, {
      last_fetch: Date.now(),
      data: json.data
    });

    return json.data;
  }
  catch {
    console.error("todo: handle error");
    throw new APIError(APIErrorType.NO_CACHE);
    // no-op
  }
}

/**
 * @param week_number - The week number **FROM THE EDT** we want to get the timetable from.
 */
export const getTimetableForWeek = async (week_number: number, year: number): Promise<ITimetable> => {
  const year_str = `A${year}`;
  const today = new Date();

  if (week_number !== -1) {
    const stored_timetable = await timetable_store(year).getItem(key(week_number, today)) as TimetableStore | null;

    const renewTimetable = async () => {
      // renew the timetable
      const renewed_timetable_response = await fetch("/api/" + year_str + "/" + week_number);
      const { data: renewed_timetable } = await renewed_timetable_response.json() as ApiTimetable;

      if (new Date(renewed_timetable.header.start_date).getFullYear() !== today.getFullYear()) {
        throw new APIError(APIErrorType.NOT_FOUND);
      }

      await timetable_store(year).setItem<TimetableStore>(key(renewed_timetable.header.week_number, today), {
        last_fetch: Date.now(),
        data: renewed_timetable
      });

      return renewed_timetable;
    }

    // if cached
    if (stored_timetable) {
      // check if the stored timetable is still valid
      const now = Date.now();
      // diff in milliseconds
      const diff = now - stored_timetable.last_fetch;

      // if the last fetch is more than 1 hour ago
      if (diff > 3_600_000) {
        try {
          // renew the timetable
          const renewed_timetable = await renewTimetable();
          return renewed_timetable;
        }
        catch {
          // if we can't renew the timetable, return the stored one.
          // mostly happens when we're offline.
          return stored_timetable.data
        }
      }

      return stored_timetable.data;
    }
    // if it's not stored
    else {
      try {
        const timetable = await renewTimetable();
        return timetable;
      } catch { /** No-op. */ }
    }
  }

  // if we're online, get the latest.
  try {
    const latest_timetable_response = await fetch("/api/latest/" + year_str);
    const { data: latest_timetable } = await latest_timetable_response.json() as ApiTimetable;

    // when there's no cache, we get the latest and we'll
    // set the current week of the user to the latest directly.
    setCurrentWeek(latest_timetable.header.week_number);
    return latest_timetable;
  }
  catch (error) {
    if (error instanceof APIError && error.type === APIErrorType.NOT_FOUND) {
      throw error;
    }

    throw new APIError(APIErrorType.NO_CACHE);
  }
}

