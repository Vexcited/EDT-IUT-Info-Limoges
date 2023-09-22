import { type Component, on, createSignal, Show, createEffect } from "solid-js";

import type { ITimetable } from "~/types/api";
import Timetable from "~/components/Timetable";

import { preferences, setSubGroup, setMainGroup, setYear } from "~/stores/preferences";

const Page: Component = () => {
  const [timetableRAW, setTimetableRAW] = createSignal<ITimetable | null>(null);

  createEffect(on(() => preferences.year, async (year) => {
    const response = await fetch(`/api/A${year}/3`);
    const json = await response.json();
    setTimetableRAW(json.data as ITimetable);
  }));

  return (
    <div class="bg-white">
      <h1>Bienvenue, étudiant en A{preferences.year}, dans la G{preferences.main_group}{preferences.sub_group === 0 ? "A" : "B"}</h1>

      <select value={preferences.year} onChange={(evt) => {
        const value = parseInt(evt.currentTarget.value);
        setYear(value);
      }}>
        <option value="1">A1</option>
        <option value="2">A2</option>
        <option value="3">A3</option>
      </select>

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

      <Show when={timetableRAW()}>
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
