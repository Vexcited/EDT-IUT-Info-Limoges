import { type Component, on, createSignal, Show, createEffect } from "solid-js";

import type { ITimetable } from "~/types/api";
import Timetable from "~/components/Timetable";

import { SettingsModal } from "~/components/modals/Settings";

import { preferences } from "~/stores/preferences";
import { day, moveDay } from "~/stores/temporary";

import { accentColor } from "~/utils/colors";
import { getTimetableFor, getWeekNumber } from "~/utils/timetables";

import MdiCog from '~icons/mdi/cog'
import MdiChevronLeft from '~icons/mdi/chevron-left'
import MdiChevronRight from '~icons/mdi/chevron-right'
import MdiChevronDoubleLeft from '~icons/mdi/chevron-double-left'
import MdiChevronDoubleRight from '~icons/mdi/chevron-double-right'
import MdiFileDocumentAlertOutline from '~icons/mdi/file-document-alert-outline'
import MdiLoading from '~icons/mdi/loading'
import MdiDownload from '~icons/mdi/download'
import MdiFilePdfBox from '~icons/mdi/file-pdf-box'

import { APIError } from "~/utils/errors";
import { generateICS } from "~/utils/ics";

const getDayString = () => day().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const Page: Component = () => {
  const [timetableRAW, setTimetableRAW] = createSignal<ITimetable | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [haveError, setHaveError] = createSignal<string | null>(null);

  createEffect(on([() => preferences.year, day], async ([year, day]) => {
    const old_timetable = timetableRAW();
    if (old_timetable?.header.week_number_in_year === getWeekNumber(day)) return;

    setTimetableRAW(null);
    setHaveError(null);
    
    try {
      const timetable = await getTimetableFor(day, year);
      setTimetableRAW(timetable);
    }
    catch (error) {
      if (error instanceof APIError) {
        setHaveError(error.message);
        return;
      }

      setHaveError((error as Error).message);
    }
  }));

  return (
    <>
      <SettingsModal open={settingsOpen()} setOpen={setSettingsOpen} />

      <div class="flex flex-col gap-0 min-h-screen h-full px-6 py-12">
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
                {timetableRAW()!.header.week_number}
              </span>.
            </Show>
          </p>

          <button type="button"
            class="flex items-center justify-center gap-2 border border-gray px-4 py-1 mt-4 text-gray bg-white hover:bg-gray hover:text-white"
            onClick={() => setSettingsOpen(true)}
          >
            <MdiCog /> Paramètres
          </button>
        </header>

        <Show when={timetableRAW()}>
          <div class="w-full text-center mt-4 flex justify-center items-center gap-4">
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
              <MdiFilePdfBox /> PDF
            </a>
          </div>
        </Show>

        <main class="mt-6">
          <p class="text-gray mt-6 mb-4 text-center sm:hidden">
            {getDayString()}
          </p>

          <nav class="flex gap-2 justify-center items-center mb-12">
            <button type="button"
              class="text-gray border border-gray p-1 text-lg hover:bg-gray hover:text-white"
              onClick={() => moveDay(-7)}
            >
              <MdiChevronDoubleLeft />
            </button>
            <button type="button"
              class="text-gray border border-gray p-1 text-xl hover:bg-gray hover:text-white"
              onClick={() => moveDay(-1)}
            >
              <MdiChevronLeft />
            </button>

            <p class="px-2 text-xl hidden sm:block px-4 max-w-[320px] w-full text-center">
              {getDayString()}
            </p>

            <span class="px-1 sm:hidden" />

            <button type="button"
              class="text-gray border border-gray p-1 text-xl hover:bg-gray hover:text-white"
              onClick={() => moveDay(+1)}
            >
              <MdiChevronRight />
            </button>
            <button type="button"
              class="text-gray border border-gray p-1 text-lg hover:bg-gray hover:text-white"
              onClick={() => moveDay(+7)}
            >
              <MdiChevronDoubleRight />
            </button>
          </nav>

          <Show when={timetableRAW()}
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
              <>
                <Timetable {...timetable()} />
              </>
            )}
          </Show>

        </main>

        <footer class="w-full text-center mt-auto">
          <p class="mt-4">
            Made with {"<3"} by <a class="font-medium hover:underline" style={{ color: accentColor() }} href="https://github.com/Vexcited">Vexcited</a>. 
          </p>
        </footer>
      </div>
    </>
  );
};

export default Page;
