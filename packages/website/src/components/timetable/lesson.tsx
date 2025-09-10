import { type Component, Show } from "solid-js";
import type { ITimetableLesson } from "~/types/api";

import { getHourString, hoursAndMinutesBetween } from "~/utils/dates";
import { getLessonDescription, getLessonContentType } from "~/utils/lessons";

import MdiTimerSandFull from '~icons/mdi/timer-sand-full';
import { setLessonModalData } from "../modals/Lesson";
import { textColorOnBG } from "~/stores/preferences";

const MobileDayTimetableLesson: Component<{
  lesson: ITimetableLesson;
  /** Whether the lesson is the last of the day or no. */
  is_last_lesson: boolean;
  /** The lesson that is right before this one. */
  lesson_before?: ITimetableLesson;
}> = (props) => {
  const start_date = () => new Date(props.lesson.start_date);

  const thereIsBreakBefore = (): boolean => {
    if (!props.lesson_before) return false;
    const end_date = new Date(props.lesson_before.end_date);
  
    const isNotSameHour = start_date().getHours() !== end_date.getHours();
    const isNotSameMinutes = start_date().getMinutes() !== end_date.getMinutes();
    
    return isNotSameHour || isNotSameMinutes; 
  };

  const Delimiter: Component<{ date: Date; }> = (props) => (
    <div class="flex items-center gap-2">
      <span class="h-[1px] w-4 border-b border-b-[rgb(62,62,62)]" />

      <p class="flex-shrink-0 text-[rgb(168,168,168)]">
        {getHourString(props.date)}
      </p>

      <span class="h-[1px] w-full border-b border-b-[rgb(62,62,62)]" />
    </div>
  );

  return (
    <>
      <Show when={thereIsBreakBefore()}>
        <Delimiter date={new Date(props.lesson_before!.end_date)} />

        <div class="flex justify-center items-center gap-6 py-4 text-[rgb(168,168,168)]">
          <MdiTimerSandFull />
          <p>
            {hoursAndMinutesBetween(start_date(), new Date(props.lesson_before!.end_date))} de vide
          </p>
        </div>
      </Show>

      <Delimiter date={start_date()} />

      <button type="button" class="focusable-lesson-for-swiper w-full text-left select-none py-1 cursor-pointer"
        onClick={() => setLessonModalData(props.lesson)}
      >
        <div class="flex flex-col gap-2 py-1.5 px-4 hover:bg-[rgb(28,28,28)] transition-colors">
          <div class="flex justify-between gap-2">
            <h2 class="text-lg text-[rgb(240,240,240)]">
              {getLessonContentType(props.lesson)}
            </h2>
            <div class="flex gap-2.5">
              <p class="text-sm border border-red text-red bg-red/10 rounded-full px-3 py-0.5 h-fit">
                {props.lesson.type}
              </p>
              <p class="text-sm bg-red rounded-full font-medium px-3 py-0.5 h-fit"
                style={{ color: textColorOnBG() }}
              >
                {props.lesson.content.room}
              </p>
            </div>
          </div>

          <p class="text-sm text-[rgb(225,225,225)]">
            {getLessonDescription(props.lesson)} avec {props.lesson.content.teacher}
          </p>
        </div>
      </div>

      <Show when={props.is_last_lesson}>
        <Delimiter date={new Date(props.lesson.end_date)} />
      </Show>
    </>
  );
};

export default MobileDayTimetableLesson;
