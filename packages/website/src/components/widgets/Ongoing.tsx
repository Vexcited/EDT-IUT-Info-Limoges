import { type Component, onMount, onCleanup, createSignal, Show } from "solid-js";
import type { ITimetableLesson } from "~/types/api";
import { DateTime } from "luxon";

import { getLessonContentType } from "~/utils/lessons";

// When we're actually in a lesson, we also get the content of next lesson for preview.
export interface IOngoingWidget {
  type: "ONGOING";
  lesson: ITimetableLesson;
  next_lesson?: ITimetableLesson;
}

const OngoingWidget: Component<IOngoingWidget> = (props) => {
  const getRemainingTime = () => DateTime.fromISO(props.lesson.end_date).setLocale("fr").toRelative();
  const getNextLessonRemainingTime = () => props.next_lesson ? DateTime.fromISO(props.next_lesson.start_date).setLocale("fr").toRelative() : null;
  const [remaining, setRemaining] = createSignal(getRemainingTime());
  const [nextLessonRemaining, setNextLessonRemaining] = createSignal(getNextLessonRemainingTime());

  let interval: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    interval = setInterval(() => {
      setRemaining(getRemainingTime());
      setNextLessonRemaining(getNextLessonRemainingTime());
    }, 1000 * 60); // update every minutes
  });

  onCleanup(() => {
    if (typeof interval !== "undefined") clearInterval(interval);
  });

  return (
    <div class="px-4 flex text-sm divide-x-2 divide-[rgb(50,50,50)]">
      <div class="py-3 flex flex-col w-full"
        classList={{
          "pr-3": Boolean(props.next_lesson)
        }}
      >
        <div class="flex flex-col gap-0.5">
          <div class="flex justify-between">
            <p class="text-[rgb(240,240,240)]">
              {getLessonContentType(props.lesson)}
            </p>
            <p class="bg-red px-2 rounded-full font-medium text-[rgb(27,27,27)]">
              {props.lesson.content.room}
            </p>
          </div>

          <p class="text-xs text-[rgb(190,190,190)]">
            {props.lesson.type} avec {props.lesson.content.teacher}
          </p>
        </div>

        <p class="text-xs pt-2 text-[rgb(200,200,200)]">
          Fin <span class="text-red">{remaining()}</span>
        </p>
      </div>

      <Show when={props.next_lesson}>
        {next_lesson => (
          <div class="pl-4 py-3 w-full">
            <div class="flex flex-col gap-0.5">
              <div class="flex justify-between">
                <p class="text-[rgb(240,240,240)]">
                  {getLessonContentType(next_lesson())}
                </p>
                <p class="bg-red px-2 rounded-full font-medium text-[rgb(27,27,27)]">
                  {next_lesson().content.room}
                </p>
              </div>

              <p class="text-xs text-[rgb(190,190,190)]">
                {next_lesson().type} avec {next_lesson().content.teacher}
              </p>
            </div>

            <p class="text-xs pt-2 text-[rgb(200,200,200)]">
              Débute <span class="text-red">{nextLessonRemaining() === remaining() ? "à la suite" : nextLessonRemaining()}</span>
            </p>
          </div>
        )}
      </Show>
    </div >
  );
};

export default OngoingWidget;
