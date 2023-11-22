import mongoose from "mongoose";
import { DBTimetable } from "./Timetable";

import {
  type TimetableEntry,
  type YEARS,

  getTimetableEntries
} from "edt-iut-info-limoges";

import type { ITimetable } from "~/types/api";

declare global {
  // These must be `var` and not `let / const`.
  // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
  var mongoose: any;
  // eslint-disable-next-line no-var
  var timetable_entries_cache: Record<string, {
    last_fetch: number,
    entries: TimetableEntry[]
  }>;
}

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error(
  "Please define the MONGODB_URI environment variable inside .env"
);

/**
 * By the way, entries are sorted by week number
 * in the library so we don't have to do it manually here.
 * 
 * So the first item of an entry is **always** the latest
 * timetable entry.
 */
global.timetable_entries_cache = {
  A1: { last_fetch: 0, entries: [] },
  A2: { last_fetch: 0, entries: [] },
  A3: { last_fetch: 0, entries: [] }
};

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  }
  catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export async function getCachedEntries(year: YEARS): Promise<TimetableEntry[]> {
  let entries: TimetableEntry[] | undefined;

  const cache = global.timetable_entries_cache[year];
  if (cache) {
    const now = Date.now();
    const diff = now - cache.last_fetch;

    // is not older than 2 minutes (renew every 2 minutes)
    if (diff < 1000 * 60 * 2) {
      // Debug.
      console.info(`[CACHE][${year}] / recovered`, cache.entries.length, "entries");
      entries = cache.entries;
    }
  }

  if (!entries) {
    entries = await getTimetableEntries(year);

    global.timetable_entries_cache[year] = {
      last_fetch: Date.now(),
      entries
    };
  }

  return entries;
}

export async function getCachedTimetable(entry: TimetableEntry): Promise<ITimetable> {
  let timetable: ITimetable | undefined;
  let shouldUpdateDatabase = false;

  const week_number = entry.week_number;
  const db_timetable = await DBTimetable(entry.from_year).findOne({
    "header.week_number": week_number
  });

  if (db_timetable) {
    const now = Date.now();
    const diff = now - db_timetable.last_fetch;

    // is not older than four hour (renew every 4 hours)
    if (diff < 1000 * 60 * 60 * 4) {
      // Debug.
      console.info(`[DB][CACHE][${entry.from_year}]`, db_timetable.header.week_number);

      timetable = {
        header: db_timetable.header,
        lessons: db_timetable.lessons,
        last_update: db_timetable.last_update
      };
    }
    // if it's older, we should renew it, so update the database.
    else shouldUpdateDatabase = true;
  }

  if (!timetable) {
    const base_timetable = await entry.getTimetable();
    const last_update = await entry.lastUpdated();
    const last_fetch = Date.now();

    // Redefine some DateTime to make
    // sure they're all in an ISO string.
    timetable = {
      header: {
        ...base_timetable.header,
        start_date: base_timetable.header.start_date.toISO()!,
        end_date: base_timetable.header.end_date.toISO()!
      },
      lessons: base_timetable.lessons.map(
        lesson => ({
          ...lesson,
          start_date: lesson.start_date.toISO()!,
          end_date: lesson.end_date.toISO()!
        })
      ),
      last_update: last_update.toISO() as string
    };

    // Means we already have the timetable inside the DB.
    if (shouldUpdateDatabase) {
      // Debug.
      console.info(`[DB][UPDATE][${entry.from_year}]`, timetable.header.week_number);

      // Update the timetable in the database.
      await DBTimetable(entry.from_year).findOneAndUpdate({
        "header.week_number": timetable.header.week_number
      }, {
        last_fetch,
        header: timetable.header,
        lessons: timetable.lessons,
        last_update: timetable.last_update
      });
    }
    // Otherwise, we don't have the timetable inside the DB.
    else {
      // Debug.
      console.info(`[DB][INSERT][${entry.from_year}]`, timetable.header.week_number);

      // Save the timetable to the database.
      await DBTimetable(entry.from_year).create({
        last_fetch,
        header: timetable.header,
        lessons: timetable.lessons,
        last_update: timetable.last_update
      });
    }
  }

  return timetable;
}