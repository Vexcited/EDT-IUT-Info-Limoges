import { type Component, createSignal, createEffect, on, createMemo, onMount, batch } from "solid-js";
import type { ITimetable } from "~/types/api";

import { SettingsModal } from "~/components/modals/Settings";
import SwiperView from "~/components/views/Swiper";

import { APIError, APIErrorType } from "~/utils/errors";
import { lessonsForSubGroup } from "~/utils/lessons";

import { getDayWeekNumber, getTimetableForWeekNumber, deleteTimetableForWeekNumber, getLatestWeekNumber } from "~/stores/timetables";
import { preferences } from "~/stores/preferences";
import { now } from "~/stores/temporary";

const [settingsOpen, setSettingsOpen] = createSignal(false);

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
  createEffect(on(now, async (now) => {
    if (now.weekNumber === last_now.weekNumber) return;
    last_now = now;

    console.info("week changed.");
    const currentWeekNumber = await updateCurrentTimetables();

    // we select current week by default, so yes copy here too.
    setSelectedWeek(currentWeekNumber ?? 0);
  }));

  /**
   * Returns the current week number.
   */
  const updateCurrentTimetables = async (): Promise<number | undefined> => {
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
    }
    catch { /** No-op, we keep it `null`. */ }

    batch(() => {
      setCurrentWeekTimetable(currentWeekTimetable);
      setNextWeekTimetable(nextWeekTimetable);
    });

    return currentWeekNumber;
  };

  onMount(async () => {
    const currentWeekNumber = await updateCurrentTimetables();

    // we select current week by default, so yes copy here too.
    setSelectedWeek(currentWeekNumber ?? 0);
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
    }
    else {
      await updateCurrentTimetables();
    }

    oldYearState = year;
    await updateTimetable();
  }));

  return (
    <>
      <SettingsModal open={settingsOpen()} setOpen={setSettingsOpen} />

      <SwiperView
        setSettingsOpen={setSettingsOpen}
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
