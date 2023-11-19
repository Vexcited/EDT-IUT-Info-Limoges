import type { ITimetableLesson, ITimetable, ITimetableHeader } from "~/types/api";
import { type Component, type Setter, createSignal, createEffect, For, on, createMemo, onMount, Show, batch, Switch, Match, onCleanup } from "solid-js";
import { SettingsModal } from "~/components/modals/Settings";

import { preferences } from "~/stores/preferences";

import MdiCog from '~icons/mdi/cog'
import MdiChevronLeft from '~icons/mdi/chevron-left'
import MdiChevronRight from '~icons/mdi/chevron-right'
import MdiTimerSandFull from '~icons/mdi/timer-sand-full'
import MdiCalendar from '~icons/mdi/calendar'
import MdiLoading from '~icons/mdi/loading'
import MdiFileDocumentAlertOutline from '~icons/mdi/file-document-alert-outline'
import MdiCheck from '~icons/mdi/check'
import MdiHeart from '~icons/mdi/heart'

import { getDayWeekNumber, getTimetableForWeekNumber, deleteTimetableForWeekNumber, getLatestWeekNumber } from "~/stores/timetables";
import { getLessonDescription, getLessonType, lessonsForSubGroup } from "~/utils/lessons";
import { getDayFromTimetable, getDayString, getGreeting, getHourString, getSmolDayString, hoursAndMinutesBetween } from "~/utils/dates";
import { generateICS } from "~/utils/ics";
import { APIError, APIErrorType } from "~/utils/errors";
import { now } from "~/stores/temporary";

import { DateTime } from "luxon";
import { createBreakpoints } from "@solid-primitives/media";

// Implement Swiper Element.
// See <https://swiperjs.com/element>.
import { type SwiperContainer, register as registerSwiperElements } from 'swiper/element/bundle';
import type Swiper from "swiper";
registerSwiperElements();

// Type elements from Swiper Element.
declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "swiper-container": any
      "swiper-slide": any
    }
  }
}

const [settingsOpen, setSettingsOpen] = createSignal(false);

const matches = createBreakpoints({
  tablet: "768px",
  laptop_small: "1024px",
  laptop_large: "1440px",
});

const MobileDayTimetableLesson: Component<{
  lesson: ITimetableLesson
  /** Whether the lesson is the last of the day or no. */
  is_last_lesson: boolean
  /** The lesson that is right before this one. */
  lesson_before: ITimetableLesson | undefined
}> = (props) => {
  const start_date = () => new Date(props.lesson.start_date);

  const thereIsBreakBefore = () => props.lesson_before && (
    start_date().getHours() !== new Date(props.lesson_before!.end_date).getHours()
  );

  const Delimiter: Component<{ date: Date }> = (props) => (
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

      <div class="px-4 py-3">
        <div class="flex flex-col gap-2">
          <div class="flex justify-between gap-2">
            <h2 class="text-lg text-[rgb(240,240,240)]">
              {getLessonType(props.lesson)}
            </h2>
            <div class="flex gap-2.5">
              <p class="text-sm border border-red text-red bg-red/10 rounded-full px-3 py-0.5 h-fit">
                {props.lesson.type}
              </p>
              <p class="text-sm text-[rgb(21,21,21)] bg-red rounded-full font-medium px-3 py-0.5 h-fit">
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
  )
}

const MobileDayTimetable: Component<{
  header: ITimetableHeader
  lessons: ITimetableLesson[]
  isToday: boolean
  dayIndex: number
}> = (props) => {
  const day = () => getDayFromTimetable(props.header, props.dayIndex);

  const now = new Date();
  const dayIsDone = () => {
    // if there's no lessons, it's always `true`.
    if (props.lessons.length === 0) return true;

    const lastLesson = props.lessons.at(-1);
    // if we don't find the last lesson, it means there's nothing so `true`.
    if (!lastLesson) return true;

    return now >= new Date(lastLesson.end_date);
  };

  return (
    <div class="w-full relative pt-6">
      <div class="absolute top-3 left-0 right-0">
        <div class="w-fit mx-auto bg-red px-4 py-1 rounded-full">
          <p class="text-sm text-[rgb(18,18,18)] font-medium">
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

// When the day is over.
interface TopDoneForTodayWidget {
  type: "DONE_FOR_TODAY",
  /** First lesson of the first day, to preview it quickly. */
  next_lesson: ITimetableLesson
}

// When there's no more lesson for the rest of the week.
type TopDoneForWeekWidget = { type: "DONE_FOR_WEEK" } & (
  | { loading: true }
  | { loading: false, is_vacation: true }
  | { loading: false, is_vacation: false, next_week_lesson?: ITimetableLesson }
)

// When it's first lesson of the day.
interface TopNextLessonWidget {
  type: "NEXT_LESSON"
  lesson: ITimetableLesson
}

// When we're actually in a lesson, we also get the content of next lesson for preview.
interface TopOngoingWidget {
  type: "ONGOING"
  lesson: ITimetableLesson
  next_lesson?: ITimetableLesson
}

type TopContent = (
  | TopDoneForTodayWidget
  | TopDoneForWeekWidget
  | TopNextLessonWidget
  | TopOngoingWidget
);

const DoneForTodayWidget: Component<TopDoneForTodayWidget> = (props) => {
  const nextDateTime = () => DateTime.fromISO(props.next_lesson.start_date).setLocale("fr")
  const farString = () => nextDateTime().toRelativeCalendar();
  const timeString = () => nextDateTime().toFormat("HH:mm");

  return (
    <div class="flex flex-col gap-1 py-3">
      <div class="flex items-center gap-2 px-4">
        <MdiCheck class="text-lg text-red" />
        <p class="text-sm text-[rgb(240,240,240)]">
          Les cours d'aujourd'hui sont terminés
        </p>
      </div>
      <div class="flex items-center gap-2 px-4">
        <MdiCalendar class="text-lg text-red" />
        <p class="text-sm text-[rgb(240,240,240)]">
          Le prochain est {farString()} à <span class="text-red font-medium">{timeString()}</span>
        </p>
      </div>

      <div class="my-2 h-[1px] border-b border-b-[rgb(50,50,50)]" />

      <p class="text-xs px-4 tablet:text-sm text-[rgb(240,240,240)]">
        Prochain: {props.next_lesson.type} de <span class="text-red font-medium">{getLessonType(props.next_lesson)}</span> ({getLessonDescription(props.next_lesson)}) en <span class="text-red font-medium">{props.next_lesson.content.room}</span> avec {props.next_lesson.content.teacher}
      </p>
    </div>
  );
};

const DoneForWeekWidget: Component<TopDoneForWeekWidget> = (props) => {
  const NextWeekLessonNotifier: Component<{ lesson: ITimetableLesson }> = (props) => {
    const start_date = () => DateTime.fromISO(props.lesson.start_date).setLocale("fr");

    return (
      <>
        <MdiCalendar class="text-lg text-red flex-shrink-0" />
        <p class="text-sm text-[rgb(220,220,220)]">
          Vous reprenez <span class="text-red font-medium">{start_date().toFormat("EEEE 'à' HH'h'mm")}</span> avec {props.lesson.type} de <span class="text-red font-medium">{getLessonDescription(props.lesson)}</span> ({getLessonType(props.lesson)}) en <span class="text-red font-medium">{props.lesson.content.room}</span> avec {props.lesson.content.teacher}
        </p>
      </>
    )
  }

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

const NextLessonWidget: Component<TopNextLessonWidget> = (props) => {
  const getRemainingTime = () => DateTime.fromISO(props.lesson.start_date).setLocale("fr").toRelative();
  const [remaining, setRemaining] = createSignal(getRemainingTime());

  let interval: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    interval = setInterval(() => {
      setRemaining(getRemainingTime())
    }, 1000 * 60) // update every minutes
  })

  onCleanup(() => {
    if (typeof interval !== "undefined") clearInterval(interval)
  })

  return (
    <div class="py-3 px-4">
      <div class="flex flex-col gap-2">
        <div class="flex justify-between gap-2">
          <h2 class="text-lg text-[rgb(240,240,240)]">
            {getLessonType(props.lesson)}
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

const OngoingWidget: Component<TopOngoingWidget> = (props) => {
  const getRemainingTime = () => DateTime.fromISO(props.lesson.end_date).setLocale("fr").toRelative();
  const getNextLessonRemainingTime = () => props.next_lesson ? DateTime.fromISO(props.next_lesson.start_date).setLocale("fr").toRelative() : null;
  const [remaining, setRemaining] = createSignal(getRemainingTime());
  const [nextLessonRemaining, setNextLessonRemaining] = createSignal(getNextLessonRemainingTime());

  let interval: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    interval = setInterval(() => {
      setRemaining(getRemainingTime())
      setNextLessonRemaining(getNextLessonRemainingTime())
    }, 1000 * 60) // update every minutes
  });

  onCleanup(() => {
    if (typeof interval !== "undefined") clearInterval(interval)
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
              {getLessonType(props.lesson)}
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
                <p>{getLessonType(next_lesson())}</p>
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
  )
}

const MobileView: Component<{
  // Timetable of the selected week.
  header?: ITimetableHeader
  lessons?: ITimetableLesson[]
  // Timetable of the current week (from today)
  currentWeekLessons?: ITimetableLesson[]
  currentWeekHeader?: ITimetableHeader
  // Timetable of the next week (+1 from current week)
  nextWeekLessons?: ITimetableLesson[]
  nextWeekHeader?: ITimetableHeader
  // Week number selected, defaults to current week.
  selectedWeekNumber: number
  setWeekNumber: Setter<number>
  // Other properties defined in initialization.
  isCurrentlyInVacation: boolean
  error: string | null
}> = (props) => {
  // Only used for slide container.
  const [activeDayIndex, setActiveDayIndex] = createSignal(now().weekday - 1);

  // Returns `undefined` when loading.
  const topContent = createMemo<TopContent | undefined>(() => {
    if (!props.currentWeekLessons) return;

    const n = now();
    const njs = n.toJSDate();

    /**
     * Note that the lessons are sorted by default.
     * So first item will be the first lesson of the day and so on.
     */
    const lessonsForCurrentDay = props.currentWeekLessons.filter(
      lesson => n.weekday === DateTime.fromISO(lesson.start_date).weekday
    );

    const lessonsForNextDay = props.currentWeekLessons.filter(
      lesson => n.weekday + 1 === DateTime.fromISO(lesson.start_date).weekday
    );

    // Check if we're done for the week.
    const lastLessonOfWeek = props.currentWeekLessons[props.currentWeekLessons.length - 1];
    let isDoneForWeek: boolean;
    if (!lastLessonOfWeek) isDoneForWeek = true;
    else isDoneForWeek = njs >= new Date(lastLessonOfWeek.end_date);

    if (!isDoneForWeek) {
      // Check if we're after the last lesson.
      const lastLessonOfDay = lessonsForCurrentDay[lessonsForCurrentDay.length - 1];
      let isDoneForToday: boolean;
      if (!lastLessonOfDay) isDoneForToday = true;
      else isDoneForToday = njs >= new Date(lastLessonOfDay.end_date);

      if (isDoneForToday) return {
        type: "DONE_FOR_TODAY",
        next_lesson: lessonsForNextDay[0]
      }
      else {
        // Check if we're at the beginning of the day.
        const first_lesson_of_day = lessonsForCurrentDay[0];
        if (njs < new Date(first_lesson_of_day.start_date)) return {
          type: "NEXT_LESSON",
          lesson: first_lesson_of_day
        }
        // We're currently in a lesson.
        else {
          const current_lesson_index = lessonsForCurrentDay.findIndex(
            lesson => njs >= new Date(lesson.start_date) && njs < new Date(lesson.end_date)
          );

          if (current_lesson_index !== -1) {
            const current_lesson = lessonsForCurrentDay[current_lesson_index];

            // Check if we're currently on the last lesson.
            if (current_lesson_index === lessonsForCurrentDay.length - 1) return {
              type: "ONGOING",
              lesson: current_lesson
            }
            else return {
              type: "ONGOING",
              lesson: current_lesson,
              next_lesson: lessonsForCurrentDay[current_lesson_index + 1]
            }
          }
          // we're in a break, we should get the very next lesson
          else {
            // get the very first occurrence of after now (so the next lesson) 
            const next_lesson = lessonsForCurrentDay.find(
              lesson => new Date(lesson.start_date) >= njs
            );

            if (!next_lesson) {
              // throw debug informations in case someone reports.
              // NOTE: maybe say end of day ?
              console.error("debug: what should happen here ?", n.toISO(), JSON.stringify(lessonsForCurrentDay));
              return;
            }

            return {
              type: "NEXT_LESSON",
              lesson: next_lesson
            }
          }
        }
      }
    }
    else {
      // still loading but we know we're done for week.
      if (!props.nextWeekHeader || typeof props.nextWeekLessons === "undefined") return {
        type: "DONE_FOR_WEEK",
        loading: true
      }

      const currentNextWeekNumber = n.plus({ weeks: 1 }).weekNumber;

      // check if the week requested is really the one coming next current week.
      if (currentNextWeekNumber === props.nextWeekHeader.week_number_in_year) {
        return {
          type: "DONE_FOR_WEEK",
          loading: false,
          is_vacation: false,
          next_week_lesson: props.nextWeekLessons[0]
        }
      }
      // if there's a gap, then it's vacations tbh
      else return {
        type: "DONE_FOR_WEEK",
        loading: false,
        is_vacation: true
      }
    }
  });

  const vacationRemaining = () => props.header?.start_date
    ? DateTime.fromISO(props.header.start_date).setLocale("fr").toRelative()
    : "(calcul en cours...)";

  const goToPreviousWeek = () => {
    if (swiperInstanceRef()) {
      // Go to Saturday
      // NOTE: Check previous week and navigate to the last non-empty day.
      swiperInstanceRef()!.swiper.slideTo(5, 0);
    }

    setActiveDayIndex(5);
    props.setWeekNumber(curr => curr - 1);
  }

  const goToNextWeek = () => {
    if (swiperInstanceRef()) {
      // go to Monday
      swiperInstanceRef()!.swiper.slideTo(0, 0);
    }

    setActiveDayIndex(0);
    props.setWeekNumber(curr => curr + 1);
  }

  let shouldSkipToNextWeek = false;
  let shouldSkipToPreviousWeek = false;

  const [swipeEdgesData, setSwipeEdgesData] = createSignal<{
    where: "left" | "right" | "none"
    progress: number
  }>({
    where: "none",
    progress: 0
  })

  const [swiperInstanceRef, setSwiperInstanceRef] = createSignal<SwiperContainer | null>(null);
  const [swiperIsBeginning, setSwiperIsBeginning] = createSignal(false);
  const [swiperIsEnd, setSwiperIsEnd] = createSignal(false);

  createEffect(on(swiperInstanceRef, (ref) => {
    if (!ref) return;

    const slideHandler = async (evt: Event & { detail: [instance: Swiper, progress: number] }) => {
      const { isEnd, isBeginning } = evt.detail[0];
      const progress = evt.detail[1];

      if (isEnd && progress > 1) {
        setSwipeEdgesData({
          where: "right",
          progress: progress - 1
        });

        shouldSkipToNextWeek = true;
        shouldSkipToPreviousWeek = false;
      }

      if (isBeginning && progress < 0) {
        setSwipeEdgesData({
          where: "left",
          progress: Math.abs(progress)
        });

        shouldSkipToNextWeek = false;
        shouldSkipToPreviousWeek = true;
      }
    }

    const transitionStartHandler = () => {
      setSwipeEdgesData(prev => ({ where: prev.where, progress: 0 }));

      if (shouldSkipToNextWeek) {
        shouldSkipToNextWeek = false;
        shouldSkipToPreviousWeek = false;
        setTimeout(() => goToNextWeek(), 150);
      }

      if (shouldSkipToPreviousWeek) {
        shouldSkipToNextWeek = false;
        shouldSkipToPreviousWeek = false;
        setTimeout(() => goToPreviousWeek(), 150);
      }
    }

    const transitionEndHandler = () => {
      setSwipeEdgesData({ where: "none", progress: 0 });
    }

    setSwiperIsBeginning(ref.swiper.isBeginning);
    setSwiperIsEnd(ref.swiper.isEnd);

    const edgeHandler = () => {
      const { isEnd, isBeginning } = ref.swiper;

      setSwiperIsBeginning(isBeginning);
      if (shouldSkipToPreviousWeek) {
        shouldSkipToPreviousWeek = false;
        setSwipeEdgesData({ where: "none", progress: 0 });
      }

      setSwiperIsEnd(isEnd);
      if (shouldSkipToNextWeek) {
        shouldSkipToNextWeek = false;
        setSwipeEdgesData({ where: "none", progress: 0 });
      }
    }

    // @ts-expect-error
    ref.addEventListener('swiperprogress', slideHandler);
    ref.addEventListener('swipertransitionstart', transitionStartHandler);
    ref.addEventListener('swipertransitionend', transitionEndHandler);
    ref.addEventListener('swiperfromedge', edgeHandler);
    ref.addEventListener('swipertoedge', edgeHandler);
    onCleanup(() => {
      // @ts-expect-error
      ref.removeEventListener('swiperprogress', slideHandler)
      ref.removeEventListener('swipertransitionstart', transitionStartHandler);
      ref.removeEventListener('swipertransitionend', transitionEndHandler);
      ref.removeEventListener('swiperfromedge', edgeHandler);
      ref.removeEventListener('swipertoedge', edgeHandler);
    });
  }));

  return (
    <>
      <header class="relative z-20 p-4 pb-2 bg-red flex justify-between items-center text-[rgb(245,245,245)]">
        <div class="flex flex-col">
          <p class="text-xl font-medium">
            {getGreeting()}
          </p>
          <p class="text-sm">
            Vous êtes en G{preferences.main_group}{preferences.sub_group === 0 ? "A" : "B"}.
          </p>
        </div>
        <div class="flex gap-2">
          <Show when={props.header && typeof props.lessons !== "undefined"}>
            <button type="button"
              class="flex items-center justify-center p-2"
              onClick={() => generateICS({
                header: props.header!,
                lessons: props.lessons!
              })}
            >
              <MdiCalendar class="text-lg" />
            </button>
          </Show>
          <button type="button"
            class="flex items-center justify-center p-2"
            onClick={() => setSettingsOpen(true)}
          >
            <MdiCog class="text-lg" />
          </button>
        </div>
      </header>

      {/* Next lesson widget at the top. */}
      <div class="sticky top-0 z-50">
        {/* Color span under the widget. */}
        <span class="absolute top-0 bg-red z-40 h-[32px] w-full" />

        <div class="relative z-50 pt-2 mx-4">
          <div class="flex justify-between gap-4">

            {/* Actual widget's code. */}
            <div class="bg-[rgb(27,27,27)] rounded-lg h-full shadow-xl mx-auto w-full tablet:(mx-0 max-w-[450px])">
              <Show when={!props.isCurrentlyInVacation}
                fallback={
                  <div class="flex flex-col justify-center py-4 px-8 h-full gap-1">
                    <div class="flex gap-2 items-center">
                      <MdiCheck class="text-red text-lg" />
                      <p class="text-[rgb(240,240,240)]">
                        Vous êtes actuellement en vacances !
                      </p>
                    </div>
                    <div class="flex gap-2 items-center">
                      <MdiCalendar class="text-red text-lg" />
                      <p class="text-[rgb(240,240,240)]">
                        Vous reprenez {vacationRemaining()}
                      </p>
                    </div>
                  </div>
                }
              >
                <Show when={topContent()} fallback={
                  <div class="flex justify-center items-center py-4 px-8 h-full">
                    <p class="text-[rgb(240,240,240)] animate-pulse">
                      Chargement du contenu...
                    </p>
                  </div>
                }>
                  {top => (
                    <Switch>
                      <Match when={top().type === "DONE_FOR_TODAY"}>
                        <DoneForTodayWidget {...top() as TopDoneForTodayWidget} />
                      </Match>
                      <Match when={top().type === "DONE_FOR_WEEK"}>
                        <DoneForWeekWidget {...top() as TopDoneForWeekWidget} />
                      </Match>
                      <Match when={top().type === "NEXT_LESSON"}>
                        <NextLessonWidget {...top() as TopNextLessonWidget} />
                      </Match>
                      <Match when={top().type === "ONGOING"}>
                        <OngoingWidget {...top() as TopOngoingWidget} />
                      </Match>
                    </Switch>
                  )}
                </Show>
              </Show>
            </div>

            <Show when={matches.tablet}>
              <div class="bg-[rgb(27,27,27)] rounded-lg shadow-xl ">
                <div class="flex flex-col items-center justify-center gap-2 px-4 py-4 laptop-sm:(flex-row justify-between gap-6 px-8) h-full">
                  <div class="flex flex-col flex-shrink-0">
                    <p class="text-lg text-[rgb(240,240,240)]">
                      {props.selectedWeekNumber === -1 ? "Récupération..." : `Semaine ${props.selectedWeekNumber}`}
                    </p>
                    <p class="text-sm text-[rgb(190,190,190)]">
                      {props.header ? (
                        `Du ${getSmolDayString(new Date(props.header.start_date))} au ${getSmolDayString(new Date(props.header.end_date))}`
                      ) : (props.error ? "Oups, y a un problème..." : "En attente de l'EDT...")}
                    </p>
                  </div>
                  <div class="flex gap-3 items-center w-full text-[rgb(240,240,240)]">
                    <button type="button" class="p-1 bg-red/20 hover:bg-red active:bg-red/60 transition border border-red rounded-full laptop-sm:(w-auto p-1.5) w-full flex justify-center items-center"
                      onClick={() => goToPreviousWeek()}
                    >
                      <MdiChevronLeft class="text-lg" />
                    </button>
                    <button type="button" class="p-1 bg-red/20 hover:bg-red active:bg-red/60 transition border border-red rounded-full laptop-sm:(w-auto p-1.5) w-full flex justify-center items-center"
                      onClick={() => goToNextWeek()}
                    >
                      <MdiChevronRight class="text-lg" />
                    </button>
                  </div>
                </div>
              </div>
            </Show>

          </div>
        </div>
      </div>

      <main class="pt-6">
        <Show when={!matches.tablet}>
          <div class="flex items-center justify-between gap-2 mb-6 px-4">
            <div class="flex flex-col flex-shrink-0">
              <p class="text-lg text-[rgb(240,240,240)]">
                {props.selectedWeekNumber === -1 ? "Récupération..." : `Semaine ${props.selectedWeekNumber}`}
              </p>
              <p class="text-xs text-[rgb(190,190,190)]">
                {props.header ? (
                  `Du ${getSmolDayString(new Date(props.header.start_date))} au ${getSmolDayString(new Date(props.header.end_date))}`
                ) : (props.error ? "Oups, y a un problème..." : "En attente de l'EDT...")}
              </p>
            </div>
            <div class="flex gap-3 items-center flex-shrink-0">
              <button type="button" class="p-1.5 bg-red/20 hover:bg-red active:bg-red/60 transition border border-red rounded-full"
                onClick={() => goToPreviousWeek()}
              >
                <MdiChevronLeft class="text-lg text-[rgb(240,240,240)]" />
              </button>
              <button type="button" class="p-1.5 bg-red/20 hover:bg-red active:bg-red/60 transition border border-red rounded-full"
                onClick={() => goToNextWeek()}
              >
                <MdiChevronRight class="text-lg text-[rgb(240,240,240)]" />
              </button>
            </div>
          </div>
        </Show>

        <Show when={props.header && props.lessons && props.lessons.length > 0}
          fallback={
            <Show when={props.error}
              fallback={
                // Loading screen.
                <div class="flex flex-col gap-4 items-center pt-10 text-[rgb(200,200,200)]">
                  <MdiLoading class="animate-spin text-4xl" />
                  <p class="animate-pulse a">
                    Chargement...
                  </p>
                </div>
              }
            >
              {error => (
                // Error screen.
                <div class="flex flex-col px-6 items-center gap-6 pt-10">
                  <MdiFileDocumentAlertOutline class="text-4xl text-red" />
                  <p class="text-center text-[rgb(235,235,235)]">
                    <span class="text-red font-medium">Erreur: </span>{error()}
                  </p>
                </div>
              )}
            </Show>
          }
        >
          <div class="relative overflow-hidden">
            <Show when={swipeEdgesData().where === "left"}>
              <div class="fixed inset-y-0 right-0 blur-lg -left-6 bg-gradient-to-r from-red to-transparent pointer-events-none"
                classList={{
                  "transition-opacity": swipeEdgesData().progress === 0
                }}
                style={{
                  opacity: swipeEdgesData().progress * 1.5
                }}
              />

              {/* <div class="fixed inset-y-0 left-20 bg-red rounded-full p-2 h-fit my-auto z-50 flex flex-col justify-center pointer-events-none"
                classList={{
                  "transition-opacity": swipeEdgesData().progress === 0
                }}
                style={{
                  opacity: swipeEdgesData().progress * 50
                }}
              >
                <MdiChevronLeft class="text-2xl text-[rgb(200,200,200)]" />
              </div> */}
            </Show>

            <Show when={swipeEdgesData().where === "right"}>
              <div class="fixed inset-y-0 left-0 blur-lg -right-6 bg-gradient-to-l from-red to-transparent pointer-events-none"
                classList={{
                  "transition-opacity": swipeEdgesData().progress === 0
                }}
                style={{
                  opacity: swipeEdgesData().progress * 1.5
                }}
              />

              {/* <div class="fixed inset-y-0 right-20 bg-red rounded-full p-2 h-fit my-auto z-50 flex flex-col justify-center pointer-events-none"
                classList={{
                  "transition-opacity": swipeEdgesData().progress === 0
                }}
                style={{
                  opacity: swipeEdgesData().progress * 50
                }}
              >
                <MdiChevronRight class="text-2xl text-[rgb(200,200,200)]" />
              </div> */}
            </Show>

            <Show when={!swiperIsBeginning()}>
              <button type="button"
                class="hidden tablet:block absolute top-1/2 left-4 transform -translate-y-1/2 bg-red/20 hover:bg-red active:bg-red/60 transition border border-red rounded-full p-2 z-50"
                onClick={() => {
                  if (!swiperInstanceRef()) return;
                  swiperInstanceRef()!.swiper.slidePrev();
                }}
              >
                <MdiChevronLeft class="text-lg text-[rgb(240,240,240)]" />
              </button>
            </Show>

            <Show when={!swiperIsEnd()}>
              <button type="button"
                class="hidden tablet:block absolute top-1/2 right-4 transform -translate-y-1/2 bg-red/20 hover:bg-red active:bg-red/60 transition border border-red rounded-full p-2 z-50"
                onClick={() => {
                  if (!swiperInstanceRef()) return;
                  swiperInstanceRef()!.swiper.slideNext();
                }}
              >
                <MdiChevronRight class="text-lg text-[rgb(240,240,240)]" />
              </button>
            </Show>

            <swiper-container ref={setSwiperInstanceRef}
              class="mx-0 tablet:mx-12"
              grab-cursor={true}
              initial-slide={activeDayIndex()}
              slides-per-view={1}
              breakpoints={{
                1440: { slidesPerView: 4 },
                1024: { slidesPerView: 3 },
                768: { slidesPerView: 2 },
              }}
            >
              <For each={Array(7).fill(null)}>
                {(_, index) => (
                  <swiper-slide>
                    <MobileDayTimetable
                      header={props.header!}
                      dayIndex={index()}
                      isToday={index() === (now().weekday - 1) && props.currentWeekHeader?.week_number === props.selectedWeekNumber}
                      lessons={props.lessons!.filter(
                        lesson => new Date(lesson.start_date).getDay() === index() + 1
                      )}
                    />
                  </swiper-slide>
                )}
              </For>
            </swiper-container>
          </div>
        </Show>
      </main>

      <footer class="w-full text-center pb-8 pt-6">
        <p class="text-sm flex gap-1 justify-center items-center text-[rgb(220,220,220)]">
          Made with <MdiHeart class="text-red" /> by <a class="font-medium hover:underline text-red" href="https://github.com/Vexcited">Vexcited</a>
        </p>
      </footer>
    </>
  )
};

const Page: Component = () => {
  const [selectedWeek, setSelectedWeek] = createSignal(-1);

  const [currentWeekTimetable, setCurrentWeekTimetable] = createSignal<ITimetable | null>(null);
  const [selectedWeekTimetable, setSelectedWeekTimetable] = createSignal<ITimetable | null>(null);
  // Useful for sneak peeks.
  const [nextWeekTimetable, setNextWeekTimetable] = createSignal<ITimetable | null>(null);

  const [error, setError] = createSignal<string | null>(null);
  const [isCurrentlyInVacation, setCurrentlyInVacation] = createSignal(false);

  /**
   * Check if we go into another week while
   * the app is opened.
   */
  let last_now = now();
  createEffect(on(now, now => {
    if (now.weekNumber === last_now.weekNumber) return;
    last_now = now;

    console.info("week changed.");
    // TODO: update timetable according to this ?
  }));

  onMount(async () => {
    let currentWeekNumber: number | undefined;

    try {
      currentWeekNumber = await getDayWeekNumber(now(), preferences.year);
    }
    catch (error) {
      if (error instanceof APIError) {
        // when the current week is not found
        // => we're in vacation.
        if (error.type === APIErrorType.NOT_FOUND) {
          currentWeekNumber = await getLatestWeekNumber(preferences.year);
          setCurrentlyInVacation(true);
        }
        else {
          setError(error.message);
          return;
        }
      }
      else {
        console.error("unhandled:", error);
        setError("Erreur inconnue(2): voir la console.");
        return;
      }
    }

    const currentWeekTimetable = await getTimetableForWeekNumber(preferences.year, currentWeekNumber);

    let nextWeekTimetable: ITimetable | null = null;
    try {
      nextWeekTimetable = await getTimetableForWeekNumber(preferences.year, currentWeekNumber + 1);
    } catch { /** No-op, we keep it `null`. */ }

    batch(() => {
      setCurrentWeekTimetable(currentWeekTimetable);
      setNextWeekTimetable(nextWeekTimetable);
      // we select current week by default, so yes copy here too.
      setSelectedWeek(currentWeekNumber!);
      setSelectedWeekTimetable(currentWeekTimetable);
    });
  });

  const forSubGroup = (timetable: ITimetable | null) => timetable ? lessonsForSubGroup(timetable, {
    main_group: preferences.main_group,
    sub_group: preferences.sub_group
  }) : undefined;

  const subGroupTimetable = createMemo(() => forSubGroup(selectedWeekTimetable()));
  const subGroupCurrentWeekTimetable = createMemo(() => forSubGroup(currentWeekTimetable()));
  const subGroupNextWeekTimetable = createMemo(() => forSubGroup(nextWeekTimetable()));

  const updateTimetable = async (force_update = false) => {
    setSelectedWeekTimetable(null);
    setError(null);

    // delete the cache so it'll fetch it below anyway.
    if (force_update) {
      await deleteTimetableForWeekNumber(preferences.year, selectedWeek());
    }

    try {
      const timetable = await getTimetableForWeekNumber(preferences.year, selectedWeek());
      setSelectedWeekTimetable(timetable);
    }
    catch (error) {
      if (error instanceof APIError) {
        setError(error.message);
      }
      else {
        console.error("unhandled:", error);
        setError("Erreur inconnue(1): voir la console.");
      }
    }
  };

  // Check if both didn't changed; don't update.
  let oldYearState = preferences.year;
  createEffect(on([() => preferences.year, selectedWeek], async ([year, week]) => {
    if (week < 0) return;

    if (year === oldYearState) {
      // also check if the week was already defined
      // and if the week didn't changed.
      if (selectedWeekTimetable() && week === selectedWeekTimetable()!.header.week_number) {
        return;
      }
    };

    oldYearState = year;
    await updateTimetable();
  }));

  return (
    <>
      <SettingsModal open={settingsOpen()} setOpen={setSettingsOpen} />

      <MobileView
        header={selectedWeekTimetable()?.header}
        lessons={subGroupTimetable()}
        currentWeekLessons={subGroupCurrentWeekTimetable()}
        currentWeekHeader={currentWeekTimetable()?.header}
        nextWeekLessons={subGroupNextWeekTimetable()}
        nextWeekHeader={nextWeekTimetable()?.header}
        selectedWeekNumber={selectedWeek()}
        setWeekNumber={setSelectedWeek}
        isCurrentlyInVacation={isCurrentlyInVacation()}
        error={error()}
      />
    </>
  );
};

export default Page;
