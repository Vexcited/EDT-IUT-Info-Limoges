import type { Timetable as ITimetableRaw, TimetableLessonCM, TimetableLessonTD, TimetableLessonTP, TimetableLessonSAE, TimetableLessonOTHER } from "edt-iut-info-limoges";

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
  | TimetableLessonSAE
  | TimetableLessonOTHER
)

export interface ITimetable {
  header: ITimetableHeader
  lessons: ITimetableLesson[]
}
