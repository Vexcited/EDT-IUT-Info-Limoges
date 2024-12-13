import type { DateTime, WeekdayNumbers } from "luxon";
import type { Page } from "@literate.ink/pdf-inspector";
import type { TimetableGroup } from "./groups";
import type { TimetableHeader } from "./header";

import { round } from "../utils/numbers";
import { getFillBounds, getTextsInFillBounds } from "./bounds";
import { COLORS, LESSON_TYPES, SUBGROUPS } from "./constants";
import { BUT_INFO_REF } from "../utils/references";

export interface TimetableLessonCM {
  type: LESSON_TYPES.CM;

  content: {
    type: string;
    raw_lesson: string;
    lesson_from_reference?: string;
    teacher: string;
    room: string;
  }
}

export interface TimetableLessonTP {
  type: LESSON_TYPES.TP;

  group: {
    main: number;
    sub: SUBGROUPS;
  }

  content: {
    type: string;
    teacher: string;
    lesson_from_reference?: string
    room: string;
  }
}

export interface TimetableLessonTD {
  type: LESSON_TYPES.TD;

  group: {
    main: number;
  }

  content: {
    type: string;
    teacher: string;
    lesson_from_reference?: string
    room: string;
  }
}

export interface TimetableLessonDS {
  type: LESSON_TYPES.DS;

  group: {
    main: number;
  }

  content: {
    type: string;
    teacher: string;
    lesson_from_reference?: string
    room: string;
  }
}

export interface TimetableLessonSAE {
  type: LESSON_TYPES.SAE;

  /** When `undefined`, it means that it's for every groups. */
  group: {
    main: number;
    /** When `undefined`, it means that it's for the whole group. */
    sub?: SUBGROUPS;
  } | undefined

  content: {
    type: string;
    teacher: string;
    lesson_from_reference?: string;
    raw_lesson?: string;
    room: string;
  }
}

export interface TimetableLessonOTHER {
  type: LESSON_TYPES.OTHER;

  content: {
    description: string;
    teacher: string;
    room: string;
  }
}

export type TimetableLesson = {
  start_date: DateTime;
  end_date: DateTime;
} & (
  | TimetableLessonCM
  | TimetableLessonTP
  | TimetableLessonTD
  | TimetableLessonDS
  | TimetableLessonSAE
  | TimetableLessonOTHER
);

export const getTimetableLessons = (page: Page, header: TimetableHeader, timings: Record<string, string>, groups: Record<string, TimetableGroup>): TimetableLesson[] => {
  const lessons: TimetableLesson[] = [];

  for (const fill of page.Fills) {
    // We only care about the fills that have a color.
    if (!fill.oc) continue;

    const color = fill.oc.toLowerCase();
    // We only care about the colors that are in our COLORS object.
    if (![COLORS.CM, COLORS.TD, COLORS.TP, COLORS.DS, COLORS.SAE].includes(color)) continue;
    
    const bounds = getFillBounds(fill);
    const contained_texts = getTextsInFillBounds(page, bounds, 4, color === COLORS.CM ? 6 : 4);
    
    const texts = contained_texts.map(text => decodeURIComponent(text.R[0].T));

    const group = groups[round(bounds.start_y, 4)];
    if (!group) continue;

    const start_time = timings[bounds.start_x];
    if (!start_time) continue;
    const [start_hour, start_minutes] = start_time.split(":").map(n => parseInt(n));
    const start_date = header.data.start_date.set({ hour: start_hour, minute: start_minutes, weekday: (group.day_index + 1) as WeekdayNumbers });

    const end_time = timings[bounds.end_x];
    if (!end_time) continue;
    const [end_hour, end_minutes] = end_time.split(":").map(n => parseInt(n));
    const end_date = header.data.start_date.set({ hour: end_hour, minute: end_minutes, weekday: (group.day_index + 1) as WeekdayNumbers });

    switch (color) {
      case COLORS.CM: {
        let [type, ...text_from_after_separator] = texts.shift()!.split(" -");
        // Remove duplicate types.
        type = [...new Set(type.split(" "))].join(" ");
        
        const room = texts.pop();
        
        let teacher = texts.pop();
        // It can happen that for some reason, the room is duplicated.
        if (teacher === room) {
          teacher = texts.pop();
        }

        if (!type || !teacher || !room) continue;

        const lesson_name = [...text_from_after_separator, ...texts].map(text => text.trim()).filter(Boolean).join(" ");
        const lesson: TimetableLesson = {
          type: LESSON_TYPES.CM,
          start_date, end_date,
          content: { type, raw_lesson: lesson_name, teacher, room, lesson_from_reference: BUT_INFO_REF[type as keyof typeof BUT_INFO_REF] }
        };

        lessons.push(lesson);
        break;
      }

      case COLORS.TP: {
        const [type, teacher, room] = texts[0].split(" - ");

        const lesson: TimetableLesson = {
          type: LESSON_TYPES.TP,
          start_date, end_date,

          group: {
            main: group.main,
            sub: group.sub
          },

          content: { type, teacher, room, lesson_from_reference: BUT_INFO_REF[type as keyof typeof BUT_INFO_REF] }
        };

        lessons.push(lesson);
        break;
      }

      case COLORS.TD: {
        const [type, teacher, room] = texts[0].split("-").map(text => text.trim());

        const lesson: TimetableLesson = {
          type: LESSON_TYPES.TD,
          start_date, end_date,

          group: {
            main: group.main
          },

          content: { type, teacher, room, lesson_from_reference: BUT_INFO_REF[type as keyof typeof BUT_INFO_REF] }
        };

        lessons.push(lesson);
        break;
      }

      case COLORS.DS: {
        const [type, teacher, room] = texts[0].split("-").map(text => text.trim());

        const lesson: TimetableLesson = {
          type: LESSON_TYPES.DS,
          start_date, end_date,

          group: {
            main: group.main
          },

          content: { type, teacher, room, lesson_from_reference: BUT_INFO_REF[type as keyof typeof BUT_INFO_REF] }
        };

        lessons.push(lesson);
        break;
      }

      case COLORS.SAE: {
        let lesson: TimetableLesson;

        /**
         * Numbers of groups that are inside the lesson bounds.
         */
        const groupsInsideBounds = Object.keys(groups).filter(rounded_start_y => {
          const rounded_start_y_number = parseFloat(rounded_start_y);
          // Added a 2pt gap to make sure that the group checked
          // is really inside the bounds. 
          return rounded_start_y_number > (bounds.start_y + 2) && rounded_start_y_number < (bounds.end_y - 2);
        }).length;
        

        // It's an SAE for a single group,
        // but in some cases can also be an SAE for a subgroup.
        if (texts.length === 1) {
          const [type, teacher, room] = texts[0].split(" - ");
          const lesson_from_reference = BUT_INFO_REF[type as keyof typeof BUT_INFO_REF];

          lesson = {
            type: LESSON_TYPES.SAE,
            start_date, end_date,
  
            group: {
              main: group.main,
              // When there's no group inside the bounds,
              // then it's for sure for a single subgroup.
              // Otherwise, it's for the full main group.
              sub: groupsInsideBounds === 0 ? group.sub : undefined
            },
  
            content: {
              type,
              room,
              teacher,
              lesson_from_reference
            }
          };
        }
        else {
          const room = texts.pop()?.trim();;
        
          let teacher = texts.pop()?.trim();
          // It can happen that for some reason, the room is duplicated.
          if (teacher === room) {
            teacher = texts.pop()?.trim();
          }

          let description = texts.map(text => text.trim()).join(" ");
          if (!teacher || !room || !description) continue;

          const first_word = description.split(" ")[0];
          const lesson_from_reference = BUT_INFO_REF[first_word as keyof typeof BUT_INFO_REF] as string | undefined;
          
          // When the lesson is in the reference, then we're sure it's an SAE.
          if (lesson_from_reference) {
            description = description.split(" - ").slice(1).join(" ");

            lesson = {
              type: LESSON_TYPES.SAE,
              start_date, end_date,

              // Only full year lessons have more than one text in the bounds.
              group: undefined,

              content: {
                type: first_word,
                teacher,
                room,
                lesson_from_reference,
                raw_lesson: description
              }
            };
          }
          // If it's not in the reference, then we can't really know what it is.
          else {
            lesson = {
              type: LESSON_TYPES.OTHER,
              start_date, end_date,
  
              content: { room, teacher, description }
            }
          }
        }

        lessons.push(lesson);
        break;
      }
    }
  }

  return lessons;
};
