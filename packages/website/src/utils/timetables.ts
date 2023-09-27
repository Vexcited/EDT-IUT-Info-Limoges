import localforage from "localforage";
import type { ITimetable, ApiTimetable } from "~/types/api";
import { APIError, APIErrorType } from "./errors";

const key = (week_number_in_year: number, day: Date) => week_number_in_year.toString() + "-" + day.getFullYear()
const timetable_store = (year: number) => localforage.createInstance({
  name: "timetables",
  storeName: "A" + year
});

interface TimetableStore {
  data: ITimetable
  // last_update: number
  last_fetch: number
}

export const deleteAllStores = async () => {
  for (const year of [1, 2, 3]) {
    await timetable_store(year).clear();
  }
}

export const deleteTimetableFromStore = async (year: number, day: Date) => {
  const week_number_in_year = getWeekNumber(day);
  await timetable_store(year).removeItem(key(week_number_in_year, day));
}

/**
 * Get the latest week number stored in the local database.
 */
export const getLatestStoredTimetable = async (year: number): Promise<TimetableStore | null> => {
  const timetables = await timetable_store(year).keys();
  const latest_stored = timetables.reduce((acc, cur) => {
    if (acc.length === 0) return cur;

    const acc_date = parseInt(acc);
    const cur_date = parseInt(cur);
    
    if (cur_date > acc_date) return cur;
    return acc;
  }, "");

  if (latest_stored.length === 0) return null;
  const timetable = await timetable_store(year).getItem(latest_stored) as TimetableStore;
  return timetable;
}

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
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
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

export const listTimetablesOnline = async (year: number) => {
  const response = await fetch("/api/list/A" + year);
  const json = await response.json();

  return json as {
    success: boolean,
    data: {
      file_name: string
      last_updated: string
      week_number: number
      from_year: string
      link: string
    }[]
  };
}

const NUMBER_OF_WEEKS_IN_YEAR = 52;

export const getTimetableFor = async (day: Date, year: number): Promise<ITimetable> => {
  const year_str = "A" + year;
  const week_number_in_year = getWeekNumber(day);

  const stored_timetable = await timetable_store(year).getItem(key(week_number_in_year, day)) as TimetableStore | null;
  if (stored_timetable) {
    // check if the stored timetable is still valid
    const now = Date.now();
    // diff in milliseconds
    const diff = now - stored_timetable.last_fetch;

    // if the last fetch is more than 1 hour ago
    if (diff > 3_600_000) {
      try {
        // renew the timetable
        const renewed_timetable_response = await fetch("/api/" + year_str + "/" + stored_timetable.data.header.week_number);
        const { data: renewed_timetable } = await renewed_timetable_response.json() as ApiTimetable;
        
        if (new Date(renewed_timetable.header.start_date).getFullYear() !== day.getFullYear()) {
          throw new APIError(APIErrorType.NOT_FOUND);
        }
        
        await timetable_store(year).setItem<TimetableStore>(key(renewed_timetable.header.week_number_in_year, day), {
          last_fetch: Date.now(),
          data: renewed_timetable
        });
  
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

  const fetchFromDiff = async (diff_header: ITimetable["header"]) => {
    let diff = week_number_in_year - diff_header.week_number_in_year;
    let week_number_to_request = diff_header.week_number + diff;

    // happens when we're in the next year
    if (week_number_to_request <= 0) {
      diff = NUMBER_OF_WEEKS_IN_YEAR + week_number_in_year - diff_header.week_number_in_year;
      week_number_to_request = diff_header.week_number + diff;
    }

    const timetable_response = await fetch("/api/" + year_str + "/" + week_number_to_request);
    if (timetable_response.status === 404) {
      throw new APIError(APIErrorType.NOT_FOUND);
    }

    const { data: timetable } = await timetable_response.json() as ApiTimetable;
    if (new Date(timetable.header.start_date).getFullYear() !== day.getFullYear()) {
      throw new APIError(APIErrorType.NOT_FOUND);
    }

    await timetable_store(year).setItem<TimetableStore>(key(timetable.header.week_number_in_year, day), {
      last_fetch: Date.now(),
      data: timetable
    });

    return timetable;
  }

  const lastStoredWeek = await getLatestStoredTimetable(year);
  // if we have a last stored, check if it's superior or equal to the current week number
  if (lastStoredWeek !== null) {
    // if we're online
    try {
      const timetable = await fetchFromDiff(lastStoredWeek.data.header);
      return timetable; 
    }
    catch (error) {
      if (error instanceof APIError && error.type === APIErrorType.NOT_FOUND) {
        throw error;
      }
      
      throw new APIError(APIErrorType.NO_CACHE);
    }
  }
 
  // if we're online, get the latest.
  try {
    const latest_timetable_response = await fetch("/api/latest/" + year_str);
    const { data: latest_timetable } = await latest_timetable_response.json() as ApiTimetable;

    const timetable = await fetchFromDiff(latest_timetable.header);
    return timetable;
  }
  catch (error) {
    if (error instanceof APIError && error.type === APIErrorType.NOT_FOUND) {
      throw error;
    }

    throw new APIError(APIErrorType.NO_CACHE);
  }
};
