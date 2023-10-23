import type { TimetableLessonCM, TimetableLessonOTHER, TimetableLessonSAE, TimetableLessonTD, TimetableLessonTP, TimetableLessonDS } from "edt-iut-info-limoges";
import { type Component, For, createMemo, Show, Accessor } from "solid-js";
import type { ITimetable } from "~/types/api";

import { hoursAndMinutesBetween } from "~/utils/dates";

import { preferences } from "~/stores/preferences";
import { day } from "~/stores/temporary";
import { accentColor } from "~/utils/colors";

const Timetable: Component<ITimetable> = (props) => {
  // is the lesson is for today (look at the day)
  const lessons_of_today = createMemo(() => props.lessons
    .filter(lesson => {
      const isForDay = new Date(lesson.start_date).getDate() === day().getDate();
      if (!isForDay) return false;

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

      if (previousLesson && (previousLesson.content as any).type === (lesson.content as any).type && previousLesson.type === lesson.type && previousLesson.content.room === lesson.content.room && previousLesson.content.teacher === lesson.content.teacher) {
        previousLesson.end_date = lesson.end_date;
      }
      else {
        acc.push(lesson);
      }

      return acc;
    }, [] as ITimetable["lessons"])
  );

  const Lesson: Component<{ lesson: ITimetable["lessons"][number], index: Accessor<number> }> = (props) => {
    const start_date = () => new Date(props.lesson.start_date);
    const end_date = () => new Date(props.lesson.end_date);

    const lesson_before = () => props.index() !== 0 ? lessons_of_today()[props.index() - 1] : null;

    return (
      <>
        <Show when={lesson_before() && start_date().getHours() !== new Date(lesson_before()!.end_date).getHours()}>
          <p class="py-4 text-subgray text-center text-white border border-gray bg-gray my-2 ml-[58px]">
            {hoursAndMinutesBetween(start_date(), new Date(lesson_before()!.end_date))} de trou
          </p>
        </Show>

        <div class="flex gap-2">
          <div class="flex flex-col justify-between w-[50px] flex-shrink-0 text-right">
            <p
              classList={{
                "opacity-25": Boolean(lesson_before()) && start_date().getHours() === new Date(lesson_before()!.end_date).getHours()
              }}
            >
              {start_date().toLocaleString("fr", { minute: "2-digit", hour: "2-digit" })}
            </p>

            <p>
              {end_date().toLocaleString("fr", { minute: "2-digit", hour: "2-digit" })}
            </p>
          </div>

          <div class="border border-gray px-4 py-2 w-full flex-shrink-1"
            classList={{
              "border-t-none": Boolean(lesson_before()) && start_date().getHours() === new Date(lesson_before()!.end_date).getHours()
            }}
          >
            <p class="text-lg font-medium">{props.lesson.type} - {(props.lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP | TimetableLessonDS).content.type ?? "??"}</p>
            <Show when={(props.lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP | TimetableLessonDS).content.lesson_from_reference || (props.lesson as TimetableLessonCM | TimetableLessonSAE).content.raw_lesson || (props.lesson as TimetableLessonOTHER).content.description}>
              {lesson => <p class="text-subgray">{lesson()}</p>}
            </Show>
            <p>En <span class="font-medium">{props.lesson.content.room}</span> avec {props.lesson.content.teacher}</p>
          </div>
        </div>
      </>
    )
  };

  return (
    <div class="max-w-[320px] w-full mx-auto">
      <For each={lessons_of_today()}
        fallback={
          <>
            <p class="text-subgray text-center text-white text-sm sm:text-lg border p-2"
              style={{ "border-color": accentColor(), "background-color": accentColor() }}
            >
              Aucun cours pour ce jour !
            </p>
            <p class="text-center text-sm mt-2">
              En attendant, vous pouvez aller <a style={{ color: accentColor() }} class="hover:underline" href="/api/video" target="_blank">
              voir cette incroyable performance
              </a>.
            </p>
          </>
        }
      >
        {(lesson, index) => <Lesson lesson={lesson} index={index} />}
      </For>
    </div>
  );
}

export default Timetable;
