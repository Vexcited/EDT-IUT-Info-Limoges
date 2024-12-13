import { type Page, parsePDF } from "@literate.ink/pdf-inspector";

import { type TimetableHeader, getTimetableHeader } from "./header";
import { getTimetableTimings } from "./timings";
import { getTimetableGroups } from "./groups";
import { getTimetableLessons, TimetableLesson } from "./lessons";

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

export const getTimetableFromBuffer = async (pdf_buffer: ArrayBuffer): Promise<Timetable> => {
  const pages = await parsePDF(pdf_buffer);
  return getTimetable(pages[0]);
};
