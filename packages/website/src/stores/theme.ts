import { createSignal } from "solid-js";

const [theme, setTheme] = createSignal(localStorage.getItem("theme") ?? "catppuccin-latte");
export { theme };

export const changeTheme = (new_theme: string) => {
  localStorage.setItem("theme", new_theme);
  setTheme(new_theme);
};
