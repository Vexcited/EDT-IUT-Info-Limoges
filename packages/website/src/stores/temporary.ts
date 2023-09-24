/// Those stores are temporary and are removed
/// at every reload of the page.

import { createSignal } from "solid-js";

/**
 * @param d - The date we want to skip, mutate. 
 * @param increase - Should we increase the date if it's a sunday, or decrease it?
 */
const skipSunday = (d: Date, increase: boolean): boolean => {
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + (increase ? 1 : -1));
    d.setHours(0, 0, 0, 0);
    return true;
  }

  return false;
};

const initialDate = new Date();
skipSunday(initialDate, true);

export const [day, setDay] = createSignal<Date>(initialDate);

export const moveDay = (amount: number) => {
  const newDay = new Date(day());
  newDay.setDate(newDay.getDate() + amount);
  if (!skipSunday(newDay, amount > 0)) {
    // set to midnight, to 
    newDay.setHours(0, 0, 0, 0);
  }

  setDay(newDay);
};
