import { type Component, onMount, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

import type { ITimetable } from "~/types/api";
import Timetable from "~/components/Timetable";

import { preferences, setSubGroup, setMainGroup } from "~/stores/preferences";

const Page: Component = () => {
  const [state] = createStore({
    year: "A1",
  });

  const [latest, setLatest] = createSignal<ITimetable | null>(null);

  onMount(async () => {
    const response = await fetch("/api/A1/3");
    const json = await response.json();
    setLatest(json.data as ITimetable);
  });

  return (
    <div class="bg-white">
      <h1>Hello! You're in {state.year}, in G{preferences.main_group}{preferences.sub_group === 0 ? "A" : "B"}</h1>

      <input type="number" value={preferences.main_group} onInput={(evt) => {
        const value = parseInt(evt.currentTarget.value);
        if (Number.isNaN(value)) {
          evt.currentTarget.value = "1";
          setMainGroup(1);
          return;
        }

        setMainGroup(value);
      }} />

      <select value={preferences.sub_group} onChange={(evt) => {
        const value = parseInt(evt.currentTarget.value);
        setSubGroup(value);
      }}>
        <option value={0}>A</option>
        <option value={1}>B</option>
      </select>

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
