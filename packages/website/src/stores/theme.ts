import { createSignal } from "solid-js";

const defaultValue = "catppuccin-latte";
let initialValue = typeof window === "undefined" ? defaultValue : localStorage.getItem("theme") ?? defaultValue;

// Can happen if people did the "no-theme bug" before it was fixed.
if (initialValue === "null") {
  initialValue = defaultValue;
  localStorage.setItem("theme", defaultValue);
}

const [theme, setTheme] = createSignal(initialValue);
export { theme };

export const changeTheme = (new_theme: string) => {
  localStorage.setItem("theme", new_theme);
  setTheme(new_theme);
};
