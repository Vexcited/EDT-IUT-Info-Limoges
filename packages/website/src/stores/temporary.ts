/// Those stores are temporary and are removed
/// at every reload of the page.

import { createSignal } from "solid-js";

export const [day, setDay] = createSignal<Date>(new Date());
export const moveDay = (amount: number) => {
  const newDay = new Date(day());
  newDay.setDate(newDay.getDate() + amount);
  // set to midnight, to 
  newDay.setHours(0, 0, 0, 0);
  setDay(newDay);
};
