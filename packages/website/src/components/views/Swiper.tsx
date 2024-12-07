import { type Component, type Setter, createSignal, createEffect, createMemo, on, onCleanup, Show, Match, Switch, For } from "solid-js";
import type { ITimetableHeader, ITimetableLesson } from "~/types/api";
import { createMediaQuery } from "@solid-primitives/media";
import { useWindowSize } from "@solid-primitives/resize-observer";
import { DateTime } from "luxon";

import MdiFileDocumentAlertOutline from "~icons/mdi/file-document-alert-outline";
import MdiChevronRight from "~icons/mdi/chevron-right";
import MdiChevronLeft from "~icons/mdi/chevron-left";
import MdiFilePdfBox from '~icons/mdi/file-pdf-box'
import MdiCalendar from "~icons/mdi/calendar";
import MdiLoading from "~icons/mdi/loading";
import MdiHeart from "~icons/mdi/heart";
import MdiCheck from '~icons/mdi/check';
import MdiCog from "~icons/mdi/cog";

import MobileDayTimetable from "~/components/timetable/relative-day";
import FixedHeightDayTimetable from "~/components/timetable/fixed-height-day"

import {
  getWidgetContent,
  DoneForTodayWidget,
  type IDoneForTodayWidget,
  DoneForWeekWidget,
  type IDoneForWeekWidget,
  NextLessonWidget,
  type INextLessonWidget,
  OngoingWidget,
  type IOngoingWidget
} from "~/components/widgets";

import { preferences, getUserCustomizationKey, textColorOnBG } from "~/stores/preferences";
import { now } from "~/stores/temporary";

import { getGreeting, getSmolDayString } from "~/utils/dates";
import { generateICS } from "~/utils/ics";

// Implement Swiper Element.
// See <https://swiperjs.com/element>.
import { type SwiperContainer, register as registerSwiperElements } from "swiper/element/bundle";
import type Swiper from "swiper";
import { TIMETABLE_HOURS } from "~/utils/hours";
import { textColorOnCustomBackground } from "~/utils/colors";
registerSwiperElements();

// Type elements from Swiper Element.
declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "swiper-container": any;
      "swiper-slide": any;
    }
  }
}

const SwiperView: Component<{
  // Setter to open the settings modal.
  setSettingsOpen: Setter<boolean>
  // Timetable of the selected week.
  header?: ITimetableHeader;
  lessons?: ITimetableLesson[];
  // Timetable of the current week (from today)
  currentWeekLessons?: ITimetableLesson[];
  currentWeekHeader?: ITimetableHeader;
  // Timetable of the next week (+1 from current week)
  nextWeekLessons?: ITimetableLesson[];
  nextWeekHeader?: ITimetableHeader;
  // Week number selected, defaults to current week.
  selectedWeekNumber: number;
  setWeekNumber: Setter<number>;
  // Other properties defined in initialization.
  isCurrentlyInVacation: boolean;
  error: string | null;
}> = (props) => {
  /**
   * Media query that tells us whenever
   * the screen is larger or equal to a tablet screen.
   */
  const isTablet = createMediaQuery("(min-width: 768px)");
  
  // Needed for fixed height timetable feature.
  const shouldUseFixedHeightDays = () => getUserCustomizationKey("use_fixed_height");
  const windowSize = useWindowSize();

  // Only used for slide container.
  const [activeDayIndex, setActiveDayIndex] = createSignal(now().weekday - 1);

  // Returns `undefined` when loading.
  const widgetContent = createMemo(() => getWidgetContent({
    currentWeekLessons: props.currentWeekLessons,
    nextWeekLessons: props.nextWeekLessons,
    nextWeekHeader: props.nextWeekHeader
  }));

  const vacationRemaining = () => props.header?.start_date
    ? DateTime.fromISO(props.header.start_date).setLocale("fr").toRelative()
    : "(calcul en cours...)";

  const goToPreviousWeek = () => {
    // prevent to go into negative weeks
    if (props.selectedWeekNumber === 1) return;

    if (swiperInstanceRef()) {
      // Go to Saturday
      // NOTE: Check previous week and navigate to the last non-empty day.
      swiperInstanceRef()!.swiper.slideTo(5, 0);
    }

    setActiveDayIndex(5);
    props.setWeekNumber(curr => curr - 1);
  };

  const goToNextWeek = () => {
    if (swiperInstanceRef()) {
      // go to Monday
      swiperInstanceRef()!.swiper.slideTo(0, 0);
    }

    setActiveDayIndex(0);
    props.setWeekNumber(curr => curr + 1);
  };

  let shouldSkipToNextWeek = false;
  let shouldSkipToPreviousWeek = false;

  const [swipeEdgesData, setSwipeEdgesData] = createSignal<{
    where: "left" | "right" | "none";
    progress: number;
  }>({
    where: "none",
    progress: 0
  });

  const [swiperInstanceRef, setSwiperInstanceRef] = createSignal<SwiperContainer | null>(null);
  const [swiperIsBeginning, setSwiperIsBeginning] = createSignal(false);
  const [swiperIsEnd, setSwiperIsEnd] = createSignal(false);

  createEffect(on(swiperInstanceRef, (ref) => {
    if (!ref) return;

    const slideHandler = async (evt: Event & { detail: [instance: Swiper, progress: number]; }) => {
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
    };

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
    };

    const transitionEndHandler = () => {
      setSwipeEdgesData({ where: "none", progress: 0 });
    };

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
    };

    // @ts-expect-error
    ref.addEventListener('swiperprogress', slideHandler);
    ref.addEventListener('swipertransitionstart', transitionStartHandler);
    ref.addEventListener('swipertransitionend', transitionEndHandler);
    ref.addEventListener('swiperfromedge', edgeHandler);
    ref.addEventListener('swipertoedge', edgeHandler);
    onCleanup(() => {
      // @ts-expect-error
      ref.removeEventListener('swiperprogress', slideHandler);
      ref.removeEventListener('swipertransitionstart', transitionStartHandler);
      ref.removeEventListener('swipertransitionend', transitionEndHandler);
      ref.removeEventListener('swiperfromedge', edgeHandler);
      ref.removeEventListener('swipertoedge', edgeHandler);
    });
  }));

  return (
    <>
      <header class="relative z-20 p-4 pb-2 bg-red flex justify-between items-center"
        style={{ color: textColorOnBG() }}
      >
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
            <a
              href={`https://edt-iut-info.unilim.fr/edt/A${preferences.year}/A${preferences.year}_S${props.header!.week_number}.pdf`}
              class="flex items-center justify-center p-2"
            >
              <MdiFilePdfBox class="text-lg" />
            </a>
          </Show>
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
            onClick={() => props.setSettingsOpen(true)}
          >
            <MdiCog class="text-lg" />
          </button>
        </div>
      </header>

      {/* Next lesson widget at the top. */}
      <div class="tablet:relative top-0 z-50"
        classList={{
          "relative": shouldUseFixedHeightDays(),
          "sticky": !shouldUseFixedHeightDays()
        }}
      >
        {/* Color span under the widget. */}
        <span class="absolute top-0 bg-red z-40 h-[32px] w-full" />

        <div class="relative z-50 pt-2 mx-4">
          <div class="flex justify-between gap-4">

            {/** Actual widget's code. */}
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
                <Show when={widgetContent()} fallback={
                  <div class="flex justify-center items-center py-4 px-8 h-full">
                    <p class="text-[rgb(240,240,240)] animate-pulse">
                      Chargement du contenu...
                    </p>
                  </div>
                }>
                  {top => (
                    <Switch>
                      <Match when={top().type === "DONE_FOR_TODAY"}>
                        <DoneForTodayWidget {...top() as IDoneForTodayWidget} />
                      </Match>
                      <Match when={top().type === "DONE_FOR_WEEK"}>
                        <DoneForWeekWidget {...top() as IDoneForWeekWidget} />
                      </Match>
                      <Match when={top().type === "NEXT_LESSON"}>
                        <NextLessonWidget {...top() as INextLessonWidget} />
                      </Match>
                      <Match when={top().type === "ONGOING"}>
                        <OngoingWidget {...top() as IOngoingWidget} />
                      </Match>
                    </Switch>
                  )}
                </Show>
              </Show>
            </div>

            {/** Week selector on ">= tablet" screens. */}
            <Show when={isTablet()}>
              <div class="bg-[rgb(27,27,27)] rounded-lg h-full shadow-xl">
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
        <Show when={!isTablet()}>
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
                  <p class="animate-pulse">
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
          <div class="relative overflow-hidden pb-3">
            <Show when={swipeEdgesData().where === "left"}>
              <div class="fixed inset-y-0 right-0 -left-6 bg-gradient-to-r from-red to-transparent pointer-events-none"
                classList={{
                  "transition-opacity": swipeEdgesData().progress === 0
                }}
                style={{
                  opacity: swipeEdgesData().progress * 1.5
                }}
              />
            </Show>

            <Show when={swipeEdgesData().where === "right"}>
              <div class="fixed inset-y-0 left-0 -right-6 bg-gradient-to-l from-red to-transparent pointer-events-none"
                classList={{
                  "transition-opacity": swipeEdgesData().progress === 0
                }}
                style={{
                  opacity: swipeEdgesData().progress * 1.5
                }}
              />
            </Show>

            <Show when={shouldUseFixedHeightDays()}>
              <div class="absolute top-12 left-0 right-0 pointer-events-none">
                <For each={TIMETABLE_HOURS}>
                  {(hour, hour_index) => (
                    // <Show when={hour_index() % 2 === 0}>
                      <div class="absolute w-full flex items-center gap-2"
                        style={{
                          top: (hour_index() * ((windowSize.height - 48) / TIMETABLE_HOURS.length)) + "px"
                        }}
                      >
                          <p class="text-[rgb(200,200,200)] text-sm text-right pl-4 shrink-0 leading-0 w-[50px] shrink-0"
                            classList={{
                              "text-[rgb(200,200,200)]": hour_index() % 2 === 0,
                              "text-[rgb(140,140,140)] opacity-20": hour_index() % 2 === 1
                            }}
                          >
                            {hour}
                          </p>

                        <div class="h-[1px] w-full mr-2 tablet:mr-6 opacity-20"
                          classList={{
                            "bg-[rgb(80,80,80)]": hour_index() % 2 === 0,
                            "bg-[rgb(50,50,50)]": hour_index() % 2 === 1
                          }}
                        />
                      </div>
                    // </Show>
                  )}
                </For>
              </div>
            </Show>

            <swiper-container ref={setSwiperInstanceRef}
              class="mx-0 tablet:(ml-16 mr-6)"
              classList={{ "ml-16": shouldUseFixedHeightDays() }}
              grab-cursor={true}
              initial-slide={activeDayIndex()}
              slides-per-view={1}
              focusable-elements=".focusable-lesson-for-swiper"
              breakpoints={{
                1660: { slidesPerView: 6 },
                1550: { slidesPerView: 5 },
                1296: { slidesPerView: 4 },
                1092: { slidesPerView: 3 },
                768: { slidesPerView: 2 },
              }}
            >
              <For each={Array(7).fill(null)}>
                {(_, index) => (
                  <swiper-slide>
                    <Show when={!shouldUseFixedHeightDays()}
                      fallback={
                        <FixedHeightDayTimetable
                          dayIndex={index()}
                          isToday={index() === (now().weekday - 1) && props.currentWeekHeader?.week_number === props.selectedWeekNumber}
                          header={props.header!}
                          lessons={props.lessons!.filter(
                            lesson => new Date(lesson.start_date).getDay() === index() + 1
                          )}
                        />
                      }
                    >
                      <MobileDayTimetable
                        header={props.header!}
                        dayIndex={index()}
                        isToday={index() === (now().weekday - 1) && props.currentWeekHeader?.week_number === props.selectedWeekNumber}
                        lessons={props.lessons!.filter(
                          lesson => new Date(lesson.start_date).getDay() === index() + 1
                        )}
                      />
                    </Show>
                  </swiper-slide>
                )}
              </For>
            </swiper-container>
          </div>
        </Show>
      </main>

      <footer class="w-full text-center pb-8 pt-6 text-[rgb(220,220,220)]">
        <p class="text-sm flex gap-1 justify-center items-center">
          Made with <MdiHeart class="text-red" /> by <a class="font-medium hover:underline text-red" href="https://github.com/Vexcited">Vexcited</a>
        </p>

        <a href={`https://github.com/Vexcited/EDT-IUT-Info-Limoges/tree/${__APP_COMMIT_SHA__=== "dev" ? "main" : __APP_COMMIT_SHA__}`} class="text-xs pt-1 text-red/80 hover:(underline text-red)">
          {__APP_COMMIT_SHA__ === "dev" ? "development version" :__APP_COMMIT_SHA__}
        </a>
      </footer>
    </>
  );
};

export default SwiperView;
