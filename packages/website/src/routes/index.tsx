import { type Component, onMount, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

import type { ITimetable } from "~/types/api";
import Timetable from "~/components/Timetable";

const Page: Component = () => {
  const [state] = createStore({
    year: "A1",
    mainGroup: 1,
    subGroup: 0,
  });

  const [latest, setLatest] = createSignal<ITimetable | null>(null);

  onMount(async () => {
    const response = await fetch("/api/A1/3");
    const json = await response.json();
    setLatest(json.data as ITimetable);
  });

  return (
    <div class="bg-white">
      <h1>Hello! You're in {state.year}, in G{state.mainGroup}{state.subGroup === 0 ? "A" : "B"}</h1>
      <Show when={latest()}>
        {timetable => (
          <main>
            <h2>Displaying timetable for week {timetable().header.week_number}.</h2>

            <Timetable {...timetable()} />
          </main>
        )}
      </Show>
    </div>
  );
};

export default Page;
