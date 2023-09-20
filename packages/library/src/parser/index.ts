import type { Page } from "pdf2json";

import { type TimetableHeader, getTimetableHeader } from "./header.js";
import { getTimetableTimings } from "./timings.js";
import { getTimetableGroups } from "./groups.js";
import { getTimetableLessons, TimetableLesson } from "./lessons.js";

export interface Timetable {
  header: TimetableHeader["data"];
  lessons: TimetableLesson[];
}

export const getTimetable = (pdf: Page): Timetable => {
  const header = getTimetableHeader(pdf);
  const timings = getTimetableTimings(pdf, header.bounds);
  const groups = getTimetableGroups(pdf, header.bounds);
  const lessons = getTimetableLessons(pdf, header, timings, groups);
  
  return {
    header: header.data,
    lessons
  };
};
