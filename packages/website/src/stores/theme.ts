import { createSignal } from "solid-js";

const defaultValue = "catppuccin-latte";
const initialValue = typeof window === "undefined" ? defaultValue : localStorage.getItem("theme") ?? defaultValue;
const [theme, setTheme] = createSignal(initialValue);
export { theme };

export const changeTheme = (new_theme: string) => {
  localStorage.setItem("theme", new_theme);
  setTheme(new_theme);
};
