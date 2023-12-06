import type { ITimetableLesson } from "~/types/api";
import { Show, type Component } from "solid-js";
import { DateTime } from "luxon";

import MdiCheck from '~icons/mdi/check';
import MdiCalendar from '~icons/mdi/calendar';

import {
  getLessonDescription,
  getLessonContentType
} from "~/utils/lessons";

// When the day is over.
export interface IDoneForTodayWidget {
  type: "DONE_FOR_TODAY",
  /**
   * First lesson of the first day, to preview it quickly.
   * May be `undefined` if there's no lesson for the next day.
   */
  next_lesson?: ITimetableLesson;
}

const NextLessonPreview: Component<{
  next_lesson: ITimetableLesson;
}> = (props) => {
  const nextDateTime = () => DateTime.fromISO(props.next_lesson.start_date).setLocale("fr");
  const farString = () => nextDateTime().toRelativeCalendar();
  const timeString = () => nextDateTime().toFormat("HH:mm");

  return (
    <>
      <div class="flex items-center gap-2 px-4">
        <MdiCalendar class="text-lg text-red" />
        <p class="text-sm text-[rgb(240,240,240)]">
          Le prochain est {farString()} à <span class="text-red font-medium">{timeString()}</span>
        </p>
      </div>

      <div class="my-2 h-[1px] border-b border-b-[rgb(50,50,50)]" />

      <p class="text-xs px-4 tablet:text-sm text-[rgb(240,240,240)]">
        Prochain: {props.next_lesson.type} de <span class="text-red font-medium">{getLessonContentType(props.next_lesson)}</span> ({getLessonDescription(props.next_lesson)}) en <span class="text-red font-medium">{props.next_lesson.content.room}</span> avec {props.next_lesson.content.teacher}
      </p>
    </>
  );
};

const DoneForTodayWidget: Component<IDoneForTodayWidget> = (props) => {
  return (
    <div class="flex flex-col gap-1 py-3">
      <div class="flex items-center gap-2 px-4">
        <MdiCheck class="text-lg text-red" />
        <p class="text-sm text-[rgb(240,240,240)]">
          Les cours d'aujourd'hui sont terminés
        </p>
      </div>
      
      <Show when={props.next_lesson}
        fallback={
          <div class="flex items-center gap-2 px-4">
            <MdiCalendar class="text-lg text-red" />
            <p class="text-sm text-[rgb(240,240,240)]">
              Vous n'avez pas cours demain !
            </p>
          </div>
        }
      >
        {next_lesson => (
          <NextLessonPreview next_lesson={next_lesson()} />
        )}
      </Show>
    </div>
  );
};

export default DoneForTodayWidget;
