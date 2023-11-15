import { type Component, on, createSignal, Show, createEffect, For, onMount } from "solid-js";

import type { ITimetable } from "~/types/api";
import Timetable from "~/components/Timetable";

import { SettingsModal } from "~/components/modals/Settings";

import { preferences, setCurrentWeek } from "~/stores/preferences";

import { accentColor } from "~/utils/colors";
import { deleteTimetableFromStore, getTimetableForWeek } from "~/utils/timetables";

import MdiCog from '~icons/mdi/cog'
import MdiChevronLeft from '~icons/mdi/chevron-left'
import MdiChevronRight from '~icons/mdi/chevron-right'
import MdiChevronDoubleLeft from '~icons/mdi/chevron-double-left'
import MdiChevronDoubleRight from '~icons/mdi/chevron-double-right'
import MdiFileDocumentAlertOutline from '~icons/mdi/file-document-alert-outline'
import MdiLoading from '~icons/mdi/loading'
import MdiDownload from '~icons/mdi/download'
import MdiFilePdfBox from '~icons/mdi/file-pdf-box'
import MdiReload from '~icons/mdi/reload'

import { APIError } from "~/utils/errors";
import { generateICS } from "~/utils/ics";
import { createMemo } from "solid-js";
import { lessonsForSubGroup } from "~/utils/lessons";

const Page: Component = () => {
  const [timetableRAW, setTimetableRAW] = createSignal<ITimetable | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [haveError, setHaveError] = createSignal<string | null>(null);
  const [dayIndex, setDayIndex] = createSignal(0); // 0 is Monday
  const subGroupTimetable = createMemo(() => timetableRAW() && lessonsForSubGroup(timetableRAW()!, {
    main_group: preferences.main_group,
    sub_group: preferences.sub_group
  }));

  const updateTimetable = async (force_update = false) => {
    setTimetableRAW(null);
    setHaveError(null);

    try {
      if (force_update) {
        await deleteTimetableFromStore(preferences.current_week, preferences.year);
      }

      const timetable = await getTimetableForWeek(preferences.current_week, preferences.year);
      setTimetableRAW(timetable);
    }
    catch (error) {
      if (error instanceof APIError) {
        setHaveError(error.message);
        return;
      }

      setHaveError((error as Error).message);
    }
  }

  const getDayFromTimetable = (index: number) => {
    const start_week_day = new Date(timetableRAW()!.header.start_date);
    // according to the day index, get the right day
    const day = new Date(start_week_day.setDate(start_week_day.getDate() + index));
    return day;
  }

  // Check if both didn't changed; don't update.
  let oldYearState = preferences.year;
  let oldCurrentWeek = preferences.current_week;
  createEffect(on([() => preferences.year, () => preferences.current_week], async ([year, week]) => {
    if (year === oldYearState && week === oldCurrentWeek) return;

    oldYearState = year;
    oldCurrentWeek = week;
    await updateTimetable();
  }));

  onMount(() => updateTimetable());

  return (
    <>
      <SettingsModal open={settingsOpen()} setOpen={setSettingsOpen} />

      <div class="flex flex-col min-h-screen h-full px-6 py-12">
        <header class="flex flex-col items-center justify-center">
          <h1 class="text-center sm:text-2xl text-gray">
            Bienvenue, étudiant en <span class="font-medium" style={{ color: accentColor() }}>
              A{preferences.year}
            </span>,
            dans le groupe <span class="font-medium" style={{ color: accentColor() }}>
              G{preferences.main_group}{preferences.sub_group === 0 ? "A" : "B"}
            </span>.
          </h1>

          <p class="text-subgray text-center text-sm sm:text-lg">
            <Show when={timetableRAW()} fallback={haveError() ? "Une erreur s'est produite." : "Récupération de l'EDT en cours..."}>
              Vous visualisez actuellement l'emploi du temps de la semaine <span class="font-medium" style={{ color: accentColor() }}>
                {preferences.current_week}
              </span>.
            </Show>
          </p>

          <button type="button"
            class="flex items-center justify-center gap-2 border border-gray px-4 py-1 mt-4 text-gray bg-white hover:bg-gray hover:text-white"
            onClick={() => setSettingsOpen(true)}
          >
            <MdiCog /> Paramètres
          </button>

          <nav class="flex gap-2 justify-center items-center mb-4 mt-6">
            <button type="button"
              class="text-gray border border-gray p-1 text-lg hover:bg-gray hover:text-white"
              onClick={() => setCurrentWeek(preferences.current_week - 1)}
            >
              <MdiChevronDoubleLeft />
            </button>
            <button type="button"
              class="xl:hidden text-gray border border-gray p-1 text-xl hover:bg-gray hover:text-white"
              onClick={() => setDayIndex(prev => {
                let new_value = prev - 1;
                if (new_value < 0) {
                  setCurrentWeek(preferences.current_week - 1);
                  new_value = 5;
                }

                return new_value;
              })}
            >
              <MdiChevronLeft />
            </button>

            <span class="px-1 xl:hidden" />

            <button type="button"
              class="xl:hidden text-gray border border-gray p-1 text-xl hover:bg-gray hover:text-white"
              onClick={() => setDayIndex(prev => {
                let new_value = prev + 1;
                if (new_value > 5) {
                  setCurrentWeek(preferences.current_week + 1);
                  new_value = 0;
                }

                return new_value;
              })}
            >
              <MdiChevronRight />
            </button>
            <button type="button"
              class="text-gray border border-gray p-1 text-lg hover:bg-gray hover:text-white"
              onClick={() => setCurrentWeek(preferences.current_week + 1)}
            >
              <MdiChevronDoubleRight />
            </button>
          </nav>
        </header>



        <Show when={timetableRAW()}>
          <>
            <div class="w-full text-center mt-6 flex justify-center items-center gap-4">
              <button
                class="flex gap-2 items-center font-medium border px-3 py-1 text-sm sm:text-base"
                style={{ color: accentColor(), "border-color": accentColor() }}
                type="button"
                onClick={() => generateICS(timetableRAW()!)}
              >
                <MdiDownload /> .ics
              </button>

              <a class="flex gap-2 items-center font-medium border px-3 py-1 text-sm sm:text-base"
                style={{ color: accentColor(), "border-color": accentColor() }}
                href={"http://edt-iut-info.unilim.fr/edt/A" + preferences.year + "/A" + preferences.year + "_S" + timetableRAW()?.header.week_number + ".pdf"}
              >
                <MdiFilePdfBox /> .pdf
              </a>
            </div>

            <button type="button"
              class="mx-auto w-fit mt-3 flex gap-2 items-center font-medium border px-3 py-1 text-xs sm:text-sm"
              style={{ color: accentColor(), "border-color": accentColor() }}
              onClick={() => updateTimetable(true)}
            >
              <MdiReload /> Actualiser
            </button>
          </>
        </Show>

        <main class="mt-16">
          <Show when={subGroupTimetable()}
            fallback={
              <Show when={haveError()}
                fallback={
                  <div class="flex flex-col gap-4 items-center justify-center border-2 p-8 mx-auto w-fit mt-8"
                    style={{ "background-color": accentColor(), "border-color": accentColor() }}
                  >
                    <MdiLoading class="animate-spin text-4xl text-white" />
                    <p class="text-white text-center">Récupération de l'emploi du temps...</p>
                  </div>
                }
              >
                {error => (
                  <div class="flex flex-col gap-4 items-center justify-center border-2 border-red bg-red p-8 mx-auto w-fit mt-8">
                    <MdiFileDocumentAlertOutline class="text-white text-4xl" />
                    <p class="text-white font-medium text-center">{error()}</p>
                  </div>
                )}
              </Show>
            }
          >
            {timetable => (
              <div class="flex gap-1">
                <For each={Array(6).fill(null)}>
                  {(_, index) => (
                    <Timetable
                      dayDate={getDayFromTimetable(index())}
                      lessonsOfDay={timetable().filter(lesson => new Date(lesson.start_date).getDay() === index() + 1)}
                      currentMobileIndex={dayIndex()}
                      index={index()}
                    />
                  )}
                </For>
              </div>
            )}
          </Show>
        </main>

        <footer class="w-full text-center mt-16">
          <p>
            Made with {"<3"} by <a class="font-medium hover:underline" style={{ color: accentColor() }} href="https://github.com/Vexcited">Vexcited</a>.
          </p>
        </footer>
      </div>
    </>
  );
};

export default Page;
