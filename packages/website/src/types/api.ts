import type { Timetable as ITimetableRaw, TimetableLessonCM, TimetableLessonTD, TimetableLessonTP, TimetableLessonDS, TimetableLessonSAE, TimetableLessonOTHER } from "edt-iut-info-limoges";

export type ITimetableHeader = Omit<ITimetableRaw["header"], "start_date" | "end_date"> & {
  start_date: string
  end_date: string
}

export type ITimetableLesson = {
  start_date: string
  end_date: string
} & (
    | TimetableLessonCM
    | TimetableLessonTD
    | TimetableLessonTP
    | TimetableLessonDS
    | TimetableLessonSAE
    | TimetableLessonOTHER
  )

export interface ITimetable {
  header: ITimetableHeader
  lessons: ITimetableLesson[]
  last_update: string
}

export interface ApiTimetableMeta {
  success: true,
  data: Array<{
    /** Week number in the current year. */
    week_number_in_year: number
    /** Week number in the PDF files. */
    week_number: number

    /** ISO string, created using `date.toISOString()`. Use `new Date(...)` to parse. */
    start_date: string
    /** ISO string, created using `date.toISOString()`. Use `new Date(...)` to parse. */
    end_date: string

    /** Last update made to the timetable. */
    last_update: string
  }>
}