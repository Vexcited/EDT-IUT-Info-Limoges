import type { DateTime } from "luxon";
import type { Page } from "pdf2json";
import type { TimetableGroup } from "./groups.js";
import type { TimetableHeader } from "./header.js";

import { round } from "../utils/numbers.js";
import { getFillBounds, getTextsInFillBounds } from "./bounds.js";
import { COLORS, LESSON_TYPES, SUBGROUPS } from "./constants.js";

export interface TimetableLessonCM {
  type: LESSON_TYPES.CM;

  start_date: DateTime;
  end_date: DateTime;

  content: {
    type: string;
    lesson: string;
    teacher: string;
    room: string;
  }
}

export interface TimetableLessonTP {
  type: LESSON_TYPES.TP;

  start_date: DateTime;
  end_date: DateTime;

  group: {
    main: number;
    sub: SUBGROUPS;
  }

  content: {
    type: string;
    teacher: string;
    room: string;
  }
}

export interface TimetableLessonTD {
  type: LESSON_TYPES.TD;

  start_date: DateTime;
  end_date: DateTime;

  group: {
    main: number;
  }

  content: {
    type: string;
    teacher: string;
    room: string;
  }
}

export type TimetableLesson = (
  | TimetableLessonCM
  | TimetableLessonTP
  | TimetableLessonTD
);

export const getTimetableLessons = (page: Page, header: TimetableHeader, timings: Record<string, string>, groups: Record<string, TimetableGroup>): TimetableLesson[] => {
  const lessons: TimetableLesson[] = [];

  for (const fill of page.Fills) {
    // We only care about the fills that have a color.
    if (!fill.oc) continue;

    const color = fill.oc.toLowerCase();
    // We only care about the colors that are in our COLORS object.
    if (!Object.values(COLORS).includes(color)) continue;

    const bounds = getFillBounds(fill);
    const contained_texts = getTextsInFillBounds(page, bounds, 5);

    const texts = contained_texts.map(text => decodeURIComponent(text.R[0].T));

    const group = groups[round(bounds.start_y)];
    if (!group) continue;

    const start_time = timings[bounds.start_x];
    if (!start_time) continue;
    const [start_hour, start_minutes] = start_time.split(":").map(n => parseInt(n));
    const start_date = header.data.start_date.set({ hour: start_hour, minute: start_minutes, weekday: group.day_index });

    const end_time = timings[bounds.end_x];
    if (!end_time) continue;
    const [end_hour, end_minutes] = end_time.split(":").map(n => parseInt(n));
    const end_date = header.data.start_date.set({ hour: end_hour, minute: end_minutes, weekday: group.day_index });

    switch (color) {
      case COLORS.CM: {
        const type = texts.shift()?.split(" -")[0];
        const room = texts.pop();
        
        let teacher = texts.pop();
        // It can happen that for some reason, the room is duplicated.
        if (teacher === room) {
          teacher = texts.pop();
        }

        if (!type || !teacher || !room) continue;

        const lesson_name = texts.map(text => text.trim()).join(" ");
        const lesson: TimetableLessonCM = {
          type: LESSON_TYPES.CM,
          start_date, end_date,
          content: { type, lesson: lesson_name, teacher, room }
        };

        lessons.push(lesson);
        break;
      }

      case COLORS.TP: {
        const [type, teacher, room] = texts[0].split(" - ");

        const lesson: TimetableLessonTP = {
          type: LESSON_TYPES.TP,
          start_date, end_date,

          group: {
            main: group.main,
            sub: group.sub
          },

          content: { type, teacher, room }
        };

        lessons.push(lesson);
        break;
      }

      case COLORS.TD: {
        const [type, teacher, room] = texts[0].split(" - ");

        const lesson: TimetableLessonTD = {
          type: LESSON_TYPES.TD,
          start_date, end_date,

          group: {
            main: group.main
          },

          content: { type, teacher, room }
        };

        lessons.push(lesson);
        break;
      }
    }
  }

  return lessons;
};