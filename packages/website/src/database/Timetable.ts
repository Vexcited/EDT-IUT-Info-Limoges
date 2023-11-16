import type { ITimetableHeader, ITimetableLesson } from "~/types/api";
import { YEARS } from "edt-iut-info-limoges";
import mongoose from "mongoose";

type DatabaseLesson = ITimetableLesson & mongoose.Document;

const DatabaseLessonSchema = new mongoose.Schema<DatabaseLesson>({
  start_date: { type: String, required: true },
  end_date: { type: String, required: true },

  type: { type: String },

  group: {
    main: { type: Number },
    sub: { type: Number },
  },

  content: {
    type: { type: String },
    raw_lesson: { type: String },
    lesson_from_reference: { type: String },
    teacher: { type: String },
    room: { type: String }
  }
});

interface DatabaseTimetable extends mongoose.Document {
  last_fetch: number
  last_update: string
  header: ITimetableHeader
  lessons: ITimetableLesson[]
}

const DatabaseTimetableSchema = new mongoose.Schema<DatabaseTimetable>({
  last_fetch: { type: Number, required: true },
  last_update: { type: String, required: true },

  header: {
    week_number: { type: Number, required: true },
    week_number_in_year: { type: Number, required: true },
    start_date: { type: String, required: true },
    end_date: { type: String, required: true }
  },

  lessons: [DatabaseLessonSchema]
});

// Define the models so it gets registered in the database.
const DBTimetableA1 = mongoose.models.A1 || mongoose.model<DatabaseTimetable>('A1', DatabaseTimetableSchema);
const DBTimetableA2 = mongoose.models.A2 || mongoose.model<DatabaseTimetable>('A2', DatabaseTimetableSchema);
const DBTimetableA3 = mongoose.models.A3 || mongoose.model<DatabaseTimetable>('A3', DatabaseTimetableSchema);

/**
 * Helper function to prevent code duplication.
 */
export const DBTimetable = (year: YEARS) => {
  switch (year) {
    case YEARS.A1: return DBTimetableA1;
    case YEARS.A2: return DBTimetableA2;
    case YEARS.A3: return DBTimetableA3;
  }
};
