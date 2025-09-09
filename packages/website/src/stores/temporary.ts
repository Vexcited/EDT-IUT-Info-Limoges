import { createSignal } from "solid-js";
import { DateTime } from "luxon";

// Global current time signal for the whole app
// that is refreshed periodically to avoid
// having to call `DateTime.now()` and refresh it everywhere.
// ! Not to use when comparing `diff` on fetch though.
const [now, setNow] = createSignal(DateTime.now());
// Only export the getter since we're not supposed to edit
// the current time.
export { now };

let __cached_interval: ReturnType<typeof setInterval> | undefined;

/**
 * We refresh the `now` signal every 10 seconds.
 */
export const initializeNowRefresh = () => {
  // Clear if already initialized before.
  if (__cached_interval) {
    clearInterval(__cached_interval);
  }

  __cached_interval = setInterval(() => {
    setNow(DateTime.now());
  }, 1000 * 10);
};
