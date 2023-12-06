import { createSignal } from "solid-js";
import { safelyGetInLocalStorage } from "~/utils/localstorage";
export type PersonalNotesStore = Record<string, string>;

const [personalNotes, setPersonalNotes] = createSignal<PersonalNotesStore>(
  JSON.parse(
    safelyGetInLocalStorage("personal_notes", "{}")
  )
);

export const setPersonalNotesForID = (id: string, content: string) => {
  setPersonalNotes((prev) => {
    const new_notes = {
      ...prev,
      [id]: content
    };

    localStorage.setItem("personal_notes", JSON.stringify(new_notes));
    return new_notes;
  });
};

export const getPersonalNotesForID = (id: string): string => personalNotes()[id] ?? "";
