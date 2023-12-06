import { type Component, onMount, onCleanup, createSignal } from "solid-js";
import type { ITimetableLesson } from "~/types/api";
import { DateTime } from "luxon";

import {
  getLessonContentType,
  getLessonDescription
} from "~/utils/lessons";

import { getHourString } from "~/utils/dates";

// When it's first lesson of the day.
export interface INextLessonWidget {
  type: "NEXT_LESSON";
  lesson: ITimetableLesson;
}

const NextLessonWidget: Component<INextLessonWidget> = (props) => {
  const getRemainingTime = () => DateTime.fromISO(props.lesson.start_date).setLocale("fr").toRelative();
  const [remaining, setRemaining] = createSignal(getRemainingTime());

  let interval: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    interval = setInterval(() => {
      setRemaining(getRemainingTime());
    }, 1000 * 60); // update every minutes
  });

  onCleanup(() => {
    if (typeof interval !== "undefined") clearInterval(interval);
  });

  return (
    <div class="py-3 px-4">
      <div class="flex flex-col gap-2">
        <div class="flex justify-between gap-2">
          <h2 class="text-lg text-[rgb(240,240,240)]">
            {getLessonContentType(props.lesson)}
          </h2>

          <div class="flex gap-2.5">
            <p class="text-sm border border-red text-red bg-red/10 rounded-full px-3 py-0.5 h-fit">
              {props.lesson.type}
            </p>
            <p class="text-sm text-[rgb(27,27,27)] font-semibold bg-red rounded-full px-3 py-0.5 h-fit">
              {props.lesson.content.room}
            </p>
          </div>
        </div>

        <p class="text-sm text-[rgb(225,225,225)]">
          {getLessonDescription(props.lesson)} avec {props.lesson.content.teacher}
        </p>

        <p class="text-xs text-[rgb(200,200,200)] ">
          Commence {remaining()} (à {getHourString(new Date(props.lesson.start_date))})
        </p>
      </div>
    </div>
  );
};

export default NextLessonWidget;
