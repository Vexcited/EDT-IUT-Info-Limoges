import { type Component, createMemo, For, Show } from "solid-js";
import type { ITimetableHeader, ITimetableLesson } from "~/types/api";

import MobileDayTimetableLesson from "./lesson";
import { getDayFromTimetable, getDayString } from "~/utils/dates";

import MdiCheck from '~icons/mdi/check';
import { textColorOnBG } from "~/stores/preferences";
import { now } from "~/stores/temporary";

const MobileDayTimetable: Component<{
  header: ITimetableHeader;
  lessons: ITimetableLesson[];
  isToday: boolean;
  dayIndex: number;
}> = (props) => {
  const day = () => getDayFromTimetable(props.header, props.dayIndex);

  const dayIsDone = createMemo(() => {
    // if there's no lessons, it's always `true`.
    if (props.lessons.length === 0) return true;

    const lastLesson = props.lessons[props.lessons.length - 1];
    // if we don't find the last lesson, it means there's nothing so `true`.
    if (!lastLesson) return true;

    return now().toMillis() >= new Date(lastLesson.end_date).getTime();
  });

  return (
    <div class="w-full relative pt-6">
      <div class="absolute top-3 left-0 right-0">
        <div class="w-fit mx-auto bg-red px-4 py-1 rounded-full">
          <p class="text-sm"
            classList={{ "font-medium": textColorOnBG() === "black" }}
            style={{ color: textColorOnBG() }}
          >
            {getDayString(day())}
          </p>
        </div>
      </div>

      <div class="bg-[rgb(21,21,21)] rounded-lg py-6 mx-4"
        classList={{
          "border-2 border-red": props.isToday
        }}
      >
        <For each={props.lessons} fallback={
          <div class="flex flex-col gap-2 items-center pt-4">
            <MdiCheck class="text-2xl text-[rgb(240,240,240)]" />
            <p class="text-[rgb(200,200,200)]">
              Pas de cours !
            </p>
          </div>
        }>
          {(lesson, lessonIndex) => (
            <MobileDayTimetableLesson
              lesson={lesson}
              is_last_lesson={lessonIndex() === props.lessons.length - 1}
              // We check if the lesson is the first one of the day or not.
              // If yes, give `undefined` directly.
              lesson_before={lessonIndex() !== 0 ? props.lessons[lessonIndex() - 1] : undefined}
            />
          )}
        </For>

        <Show when={props.isToday && props.lessons.length > 0 && dayIsDone()}>
          <div class="flex p-4 gap-2 items-center justify-center text-red bg-red/15 mt-2">
            <MdiCheck class="text-xl" />
            <p>La journée est terminée !</p>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default MobileDayTimetable;
