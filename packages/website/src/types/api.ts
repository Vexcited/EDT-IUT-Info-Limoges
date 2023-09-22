import type { Timetable as ITimetableRaw } from "edt-iut-info-limoges";

export type ITimetableHeader = Omit<ITimetableRaw["header"], "start_date" | "end_date"> & {
  start_date: string
  end_date: string
}

export type ITimetableLesson = Omit<ITimetableRaw["lessons"][number], "start_date" | "end_date"> & {
  start_date: string
  end_date: string
}

export interface ITimetable {
  header: ITimetableHeader
  lessons: ITimetableLesson[]
}
