import type { ITimetableLesson } from "~/types/api";
import { type Component, Show } from "solid-js";
import { DateTime } from "luxon";

import MdiCheck from '~icons/mdi/check';
import MdiLoading from '~icons/mdi/loading';
import MdiCalendar from '~icons/mdi/calendar';
import { getLessonDescription, getLessonContentType } from "~/utils/lessons";

// When there's no more lesson for the rest of the week.
export type IDoneForWeekWidget = { type: "DONE_FOR_WEEK"; } & (
  | { loading: true; }
  | { loading: false, is_vacation: true; }
  | { loading: false, is_vacation: false, next_week_lesson?: ITimetableLesson; }
);

const DoneForWeekWidget: Component<IDoneForWeekWidget> = (props) => {
  const NextWeekLessonNotifier: Component<{ lesson: ITimetableLesson; }> = (props) => {
    const start_date = () => DateTime.fromISO(props.lesson.start_date).setLocale("fr");

    return (
      <>
        <MdiCalendar class="text-lg text-red flex-shrink-0" />
        <p class="text-sm text-[rgb(220,220,220)]">
          Vous reprenez <span class="text-red font-medium">{start_date().toFormat("EEEE 'à' HH'h'mm")}</span> avec {props.lesson.type} de <span class="text-red font-medium">{getLessonDescription(props.lesson)}</span> ({getLessonContentType(props.lesson)}) en <span class="text-red font-medium">{props.lesson.content.room}</span> avec {props.lesson.content.teacher}
        </p>
      </>
    );
  };

  return (
    <div class="flex flex-col gap-1 py-3">
      <div class="flex items-center gap-2 px-4">
        <MdiCheck class="text-lg text-red flex-shrink-0" />
        <p class="text-sm text-[rgb(240,240,240)]">
          Les cours de la semaine sont terminés !
        </p>
      </div>

      <div class="flex items-start gap-2 px-4">
        <Show keyed when={!props.loading && props}
          fallback={
            <>
              <MdiLoading class="text-lg text-red animate-spin flex-shrink-0" />
              <p class="text-sm text-[rgb(240,240,240)]">
                Chargement de la semaine prochaine...
              </p>
            </>
          }
        >
          {props => (
            <Show when={!props.is_vacation && props}
              fallback={
                <>
                  <MdiCheck class="text-lg text-red flex-shrink-0" />
                  <p class="text-sm text-[rgb(240,240,240)]">
                    Vous êtes maintenant en vacances !
                  </p>
                </>
              }
            >
              {props => (
                <Show when={props().next_week_lesson}
                  fallback={
                    <>
                      <MdiCheck class="text-lg text-red flex-shrink-0" />
                      <p class="text-sm text-[rgb(240,240,240)]">
                        Vous n'avez pas cours la semaine prochaine !
                      </p>
                    </>
                  }
                >
                  {next_week_lesson => (
                    <NextWeekLessonNotifier
                      lesson={next_week_lesson()}
                    />
                  )}
                </Show>
              )}
            </Show>
          )}
        </Show>
      </div>
    </div>
  );
};

export default DoneForWeekWidget;
