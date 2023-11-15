import type { TimetableLessonCM, TimetableLessonOTHER, TimetableLessonSAE, TimetableLessonTD, TimetableLessonTP, TimetableLessonDS } from "edt-iut-info-limoges";
import { type Component, For, Show, Accessor } from "solid-js";
import type { ITimetable } from "~/types/api";

import { hoursAndMinutesBetween } from "~/utils/dates";
import { accentColor } from "~/utils/colors";

const getDayString = (day: Date) => day.toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

const Timetable: Component<{ lessonsOfDay: ITimetable["lessons"], index: number, currentMobileIndex: number, dayDate: Date }> = (props) => {
  const Lesson: Component<{ lesson: ITimetable["lessons"][number], index: Accessor<number> }> = (lesson_props) => {
    const start_date = () => new Date(lesson_props.lesson.start_date);
    const end_date = () => new Date(lesson_props.lesson.end_date);

    const lesson_before = () => lesson_props.index() !== 0 ? props.lessonsOfDay[lesson_props.index() - 1] : null;

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
            <p class="text-lg font-medium">{lesson_props.lesson.type} - {(lesson_props.lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP | TimetableLessonDS).content.type ?? "??"}</p>
            <Show when={(lesson_props.lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP | TimetableLessonDS).content.lesson_from_reference || (lesson_props.lesson as TimetableLessonCM | TimetableLessonSAE).content.raw_lesson || (lesson_props.lesson as TimetableLessonOTHER).content.description}>
              {lesson => <p class="text-subgray">{lesson()}</p>}
            </Show>
            <p>En <span class="font-medium">{lesson_props.lesson.content.room}</span> avec {lesson_props.lesson.content.teacher}</p>
          </div>
        </div>
      </>
    )
  };

  return (
    <div
      classList={{
        // mobile stuff
        "mx-auto": props.index === props.currentMobileIndex,
        "hidden": props.index !== props.currentMobileIndex,

        // only for desktop
        "xl:hidden": props.lessonsOfDay.length === 0 && props.index === 5, // if saturday and no lesson, don't show
        "xl:block": props.lessonsOfDay.length !== 0 || props.index !== 5, // if saturday and lesson, show
      }}
    >
      <p class="px-2 text-base block pb-6 max-w-[320px] w-full text-center">
        {getDayString(props.dayDate)}
      </p>
      <div class="max-w-[320px] w-full mx-auto">
        <For each={props.lessonsOfDay}
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
    </div>
  );
}

export default Timetable;
