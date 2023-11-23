import type { ITimetableHeader, ITimetableLesson } from "~/types/api";
import { now } from "~/stores/temporary";
import { DateTime } from "luxon";

import type { IDoneForTodayWidget } from "./DoneForToday";
import type { IDoneForWeekWidget } from "./DoneForWeek";
import type { INextLessonWidget } from "./NextLesson";
import type { IOngoingWidget } from "./Ongoing";

export { default as DoneForTodayWidget } from "./DoneForToday";
export { default as DoneForWeekWidget } from "./DoneForWeek";
export { default as NextLessonWidget } from "./NextLesson";
export { default as OngoingWidget } from "./Ongoing";

export type {
  IDoneForTodayWidget,
  IDoneForWeekWidget,
  INextLessonWidget,
  IOngoingWidget
};

export type WidgetContent = (
  | IDoneForTodayWidget
  | IDoneForWeekWidget
  | INextLessonWidget
  | IOngoingWidget
);

export const getWidgetContent = (data: {
  // Timetable of the current week (from today)
  currentWeekLessons?: ITimetableLesson[]
  // Timetable of the next week (+1 from current week)
  nextWeekLessons?: ITimetableLesson[];
  nextWeekHeader?: ITimetableHeader;
}): WidgetContent | undefined => {
  if (!data.currentWeekLessons) return;

  const n = now();
  const njs = n.toJSDate();

  /**
   * Note that the lessons are sorted by default.
   * So first item will be the first lesson of the day and so on.
   */
  const lessonsForCurrentDay = data.currentWeekLessons.filter(
    lesson => n.weekday === DateTime.fromISO(lesson.start_date).weekday
  );

  const lessonsForNextDay = data.currentWeekLessons.filter(
    lesson => n.weekday + 1 === DateTime.fromISO(lesson.start_date).weekday
  );

  // Check if we're done for the week.
  const lastLessonOfWeek = data.currentWeekLessons[data.currentWeekLessons.length - 1];
  let isDoneForWeek: boolean;
  if (!lastLessonOfWeek) isDoneForWeek = true;
  else isDoneForWeek = njs >= new Date(lastLessonOfWeek.end_date);

  if (!isDoneForWeek) {
    // Check if we're after the last lesson.
    const lastLessonOfDay = lessonsForCurrentDay[lessonsForCurrentDay.length - 1];
    let isDoneForToday: boolean;
    if (!lastLessonOfDay) isDoneForToday = true;
    else isDoneForToday = njs >= new Date(lastLessonOfDay.end_date);

    if (isDoneForToday) return {
      type: "DONE_FOR_TODAY",
      next_lesson: lessonsForNextDay[0]
    };
    else {
      // Check if we're at the beginning of the day.
      const first_lesson_of_day = lessonsForCurrentDay[0];
      if (njs < new Date(first_lesson_of_day.start_date)) return {
        type: "NEXT_LESSON",
        lesson: first_lesson_of_day
      };
      // We're currently in a lesson.
      else {
        const current_lesson_index = lessonsForCurrentDay.findIndex(
          lesson => njs >= new Date(lesson.start_date) && njs < new Date(lesson.end_date)
        );

        if (current_lesson_index !== -1) {
          const current_lesson = lessonsForCurrentDay[current_lesson_index];

          // Check if we're currently on the last lesson.
          if (current_lesson_index === lessonsForCurrentDay.length - 1) return {
            type: "ONGOING",
            lesson: current_lesson
          };
          else return {
            type: "ONGOING",
            lesson: current_lesson,
            next_lesson: lessonsForCurrentDay[current_lesson_index + 1]
          };
        }
        // we're in a break, we should get the very next lesson
        else {
          // get the very first occurrence of after now (so the next lesson) 
          const next_lesson = lessonsForCurrentDay.find(
            lesson => new Date(lesson.start_date) >= njs
          );

          if (!next_lesson) {
            // throw debug informations in case someone reports.
            // NOTE: maybe say end of day ?
            console.error("debug: what should happen here ?", n.toISO(), JSON.stringify(lessonsForCurrentDay));
            return;
          }

          return {
            type: "NEXT_LESSON",
            lesson: next_lesson
          };
        }
      }
    }
  }
  else {
    // still loading but we know we're done for week.
    if (!data.nextWeekHeader || typeof data.nextWeekLessons === "undefined") return {
      type: "DONE_FOR_WEEK",
      loading: true
    };

    const currentNextWeekNumber = n.plus({ weeks: 1 }).weekNumber;

    // check if the week requested is really the one coming next current week.
    if (currentNextWeekNumber === data.nextWeekHeader.week_number_in_year) {
      return {
        type: "DONE_FOR_WEEK",
        loading: false,
        is_vacation: false,
        next_week_lesson: data.nextWeekLessons[0]
      };
    }
    // if there's a gap, then it's vacations tbh
    else return {
      type: "DONE_FOR_WEEK",
      loading: false,
      is_vacation: true
    };
  }
};
