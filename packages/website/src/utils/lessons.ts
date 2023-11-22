import type { TimetableLessonCM, TimetableLessonDS, TimetableLessonOTHER, TimetableLessonSAE, TimetableLessonTD, TimetableLessonTP } from "edt-iut-info-limoges";
import type { ITimetable } from "~/types/api";

export const lessonsForSubGroup = (timetable: Omit<ITimetable, "last_update">, preferences: {
  main_group: number
  sub_group: 0 | 1;
}) => {
  const lessons = timetable.lessons.filter(lesson => {
    let isForUser = false;

    switch (lesson.type) {
      case "TP":
        isForUser = lesson.group.sub === preferences.sub_group && lesson.group.main === preferences.main_group;
        break;

      case "TD":
      case "DS":
      case "SAE":
        // It's for everyone.
        if (typeof lesson.group === "undefined") {
          isForUser = true;
          break;
        }
        // There's a specific subgroup can happen on SAEs.
        else if (lesson.type === "SAE" && typeof lesson.group.sub !== "undefined") {
          // So in that case we should check for main group and subgroup.
          isForUser = lesson.group.main === preferences.main_group && lesson.group.sub === preferences.sub_group;
          break;
        }
        // Otherwise, we just check for the main group.
        else {
          isForUser = lesson.group.main === preferences.main_group;
          break;
        }

      // Since CM lessons are for the whole year, we don't
      // need to check any group and/or subgroup.
      case "CM":
      case "OTHER":
        isForUser = true;
        break;
    }

    return isForUser;
  })
    .sort((a, b) => {
      const aDate = new Date(a.start_date);
      const bDate = new Date(b.start_date);

      return aDate.getTime() - bDate.getTime();
    })
    // Remove the lessons that are the same as the previous one
    // (like same type, same room, same teacher, but with just a +1 index difference in the array)
    // Also update the `end_date` of the previous lesson to the `end_date` of the current lesson.
    .reduce((acc, lesson, index, array) => {
      const previousLesson = array[index - 1];

      if (previousLesson) {
        const previousLessonDate = new Date(previousLesson.start_date);
        const lessonDate = new Date(lesson.start_date);

        // if not same day, we should not merge them.
        if (previousLessonDate.getDate() !== lessonDate.getDate()) {
          acc.push(lesson);
          return acc;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (previousLesson && (previousLesson.content as any).type === (lesson.content as any).type && previousLesson.type === lesson.type && previousLesson.content.room === lesson.content.room && previousLesson.content.teacher === lesson.content.teacher) {
        previousLesson.end_date = lesson.end_date;
      }
      else {
        acc.push(lesson);
      }

      return acc;
    }, [] as ITimetable["lessons"]);

  return lessons;
};

export const getLessonDescription = (lesson: ITimetable["lessons"][number]): string => (
  (
    (lesson as (
      | TimetableLessonCM
      | TimetableLessonSAE
      | TimetableLessonTD
      | TimetableLessonTP
      | TimetableLessonDS
    )).content.lesson_from_reference
  ) || (
    (lesson as (
      | TimetableLessonCM
      | TimetableLessonSAE
    )).content.raw_lesson
  ) || (
    (lesson as TimetableLessonOTHER).content.description
  ) || "(Inconnu)"
);

export const getLessonType = (lesson: ITimetable["lessons"][number]): string => (
  (lesson as (
    | TimetableLessonCM
    | TimetableLessonSAE
    | TimetableLessonTD
    | TimetableLessonTP
    | TimetableLessonDS
  )).content.type ?? "??"
);
