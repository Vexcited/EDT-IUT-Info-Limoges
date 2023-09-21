import { type Component, onMount, createSignal } from "solid-js";
import { createStore } from "solid-js/store";

import type { Timetable } from "edt-iut-info-limoges"

const Page: Component = () => {
  const [state, setState] = createStore({
    year: "A1",
    mainGroup: 1,
    subGroup: 0,
  });

  const [latest, setLatest] = createSignal<Timetable | null>(null);

  onMount(async () => {
    const response = await fetch("/api/latest/" + state.year);
    const json = await response.json();
    setLatest(json.data as Timetable);
  });

  return (
    <div>
      <h1>Hello! You're in {state.year}, in G{state.mainGroup}{state.subGroup === 0 ? "A" : "B"}</h1>
    </div>
  );
};

export default Page;
