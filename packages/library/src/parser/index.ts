import type { Page } from "../converter/pdfparser.js";

import { type TimetableHeader, getTimetableHeader } from "./header.js";
import { getTimetableTimings } from "./timings.js";
import { getTimetableGroups } from "./groups.js";
import { getTimetableLessons, TimetableLesson } from "./lessons.js";

export interface Timetable {
  header: TimetableHeader["data"];
  lessons: TimetableLesson[];
}

export const getTimetable = (page: Page): Timetable => {
  const header = getTimetableHeader(page);
  const timings = getTimetableTimings(page, header.bounds);
  const groups = getTimetableGroups(page, header.bounds);
  const lessons = getTimetableLessons(page, header, timings, groups);
  
  return {
    header: header.data,
    lessons
  };
};
