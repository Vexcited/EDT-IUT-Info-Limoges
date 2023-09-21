import type { Page } from "../converter";

import { type TimetableHeader, getTimetableHeader } from "./header";
import { getTimetableTimings } from "./timings";
import { getTimetableGroups } from "./groups";
import { getTimetableLessons, TimetableLesson } from "./lessons";

import { getRawPDF } from "../utils/pdf";

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
  const pdf_raw_data = await getRawPDF(pdf_buffer);
  const pdf = pdf_raw_data.Pages[0];

  const timetable = getTimetable(pdf);
  return timetable;
};