import { type Component, on, createSignal, Show, createEffect } from "solid-js";

import type { ITimetable } from "~/types/api";
import Timetable from "~/components/Timetable";

import { SettingsModal } from "~/components/modals/Settings";

import { preferences } from "~/stores/preferences";
import { accentColor } from "~/utils/colors";
import { getTimetableFor } from "~/utils/timetables";

import MdiCog from '~icons/mdi/cog'

const Page: Component = () => {
  const [timetableRAW, setTimetableRAW] = createSignal<ITimetable | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  createEffect(on(() => preferences.year, async (year) => {
    const today = new Date();
    const timetable = await getTimetableFor(today, year);
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

        <main>
          <Show when={timetableRAW()}>
            {timetable => <Timetable {...timetable()} />}
          </Show>
        </main>
      </div>
    </>
  );
};

export default Page;
