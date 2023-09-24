import { type Component, on, createSignal, Show, createEffect, createMemo } from "solid-js";

import type { ITimetable } from "~/types/api";
import Timetable from "~/components/Timetable";

import { SettingsModal } from "~/components/modals/Settings";

import { preferences } from "~/stores/preferences";
import { day, moveDay } from "~/stores/temporary";

import { accentColor } from "~/utils/colors";
import { getTimetableFor } from "~/utils/timetables";

import MdiCog from '~icons/mdi/cog'
import MdiChevronLeft from '~icons/mdi/chevron-left'
import MdiChevronRight from '~icons/mdi/chevron-right'
import MdiChevronDoubleLeft from '~icons/mdi/chevron-double-left'
import MdiChevronDoubleRight from '~icons/mdi/chevron-double-right'

const getDayString = createMemo(() => day().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}));

const Page: Component = () => {
  const [timetableRAW, setTimetableRAW] = createSignal<ITimetable | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  createEffect(on([() => preferences.year, day], async ([year, day]) => {
    const timetable = await getTimetableFor(day, year);
    setTimetableRAW(timetable);
  }));

  return (
    <>
      <SettingsModal open={settingsOpen()} setOpen={setSettingsOpen} />

      <div class="p-6">
        <header class="flex flex-col items-center justify-center pt-4">
          <h1 class="text-center sm:text-2xl text-gray">
            Bienvenue, étudiant en <span class="font-medium" style={{ color: accentColor() }}>
              A{preferences.year}
            </span>,
            dans le groupe <span class="font-medium" style={{ color: accentColor() }}>
              G{preferences.main_group}{preferences.sub_group === 0 ? "A" : "B"}
            </span>.
          </h1>
          <Show when={timetableRAW()}
            fallback={<p>Récupération de l'emploi du temps...</p>}
          >
            <p class="text-subgray-1 text-center text-sm sm:text-lg">
              Vous visualisez actuellement l'emploi du temps de la semaine <span class="font-medium" style={{ color: accentColor() }}>
                {timetableRAW()!.header.week_number}
              </span>.
            </p>
          </Show>

          <button type="button"
            class="flex items-center justify-center gap-2 border border-gray px-4 py-1 mt-4 text-gray bg-white hover:bg-gray hover:text-white"
            onClick={() => setSettingsOpen(true)}
          >
            <MdiCog /> Paramètres
          </button>
        </header>

        <main class="pt-8 sm:pt-10">
          <p class="text-gray mb-1 text-center sm:hidden">
            {getDayString()}
          </p>

          <nav class="flex gap-2 justify-center items-center mb-8">
            <button type="button"
              class="text-gray border border-gray p-1 text-xl"
              onClick={() => moveDay(-7)}
            >
              <MdiChevronDoubleLeft />
            </button>
            <button type="button"
              class="text-gray border border-gray p-1 text-xl"
              onClick={() => moveDay(-1)}
            >
              <MdiChevronLeft />
            </button>

            <p class="px-2 text-xl hidden sm:block px-4 max-w-[320px] w-full text-center">
              {getDayString()}
            </p>

            <span class="px-1 sm:hidden" />

            <button type="button"
              class="text-gray border border-gray p-1 text-xl"
              onClick={() => moveDay(+1)}
            >
              <MdiChevronRight />
            </button>
            <button type="button"
              class="text-gray border border-gray p-1 text-xl"
              onClick={() => moveDay(+7)}
            >
              <MdiChevronDoubleRight />
            </button>
          </nav>

          <Show when={timetableRAW()}>
            {timetable => (
              <>
                <Timetable {...timetable()} />

                <div class="w-full text-center mt-14">
                  <a class="text-lg font-medium border px-3 py-1"
                    style={{ color: accentColor(), "border-color": accentColor() }}
                    href={"http://edt-iut-info.unilim.fr/edt/A" + preferences.year + "/A" + preferences.year + "_S" + timetableRAW()?.header.week_number + ".pdf"}
                    target="_blank"
                  >
                    PDF
                  </a>

                  <p class="mt-4">
                    Made with {"<3"} by <a class="font-medium" style={{ color: accentColor() }} href="https://github.com/Vexcited" target="_blank">Vexcited</a>. 
                  </p>
                </div>
              </>
            )}
          </Show>

        </main>
      </div>
    </>
  );
};

export default Page;
