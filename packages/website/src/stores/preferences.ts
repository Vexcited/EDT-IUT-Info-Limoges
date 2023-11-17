import { createStore } from "solid-js/store";
import { getYearFromMainGroup } from "~/utils/groups";

interface UserCustomization {
  primary_color?: string
}

export const DEFAULT_USER_CUSTOMIZATION: Required<UserCustomization> = {
  primary_color: "248, 113, 113"
}

const safelyGetInLocalStorage = (key: string, default_value: string): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(key) ?? default_value;
  }

  // only happens server-side.
  return default_value;
}

export const [preferences, setPreferences] = createStore({
  get year(): number {
    return getYearFromMainGroup(this.main_group);
  },
  main_group: parseInt(safelyGetInLocalStorage("main_group", "1")),
  sub_group: parseInt(safelyGetInLocalStorage("sub_group", "0")) as 0 | 1,
  customization: JSON.parse(safelyGetInLocalStorage("user_customization", "{}")) as UserCustomization,
});

export const setYear = (year: number) => {
  localStorage.setItem("year", year.toString());
  setPreferences({ year });
};

export const setMainGroup = (main_group: number) => {
  localStorage.setItem("main_group", main_group.toString());
  setPreferences({ main_group });
}

export const setSubGroup = (sub_group: 0 | 1) => {
  localStorage.setItem("sub_group", sub_group.toString());
  setPreferences({ sub_group });
}

export const setUserCustomization = (customization: UserCustomization) => {
  localStorage.setItem("user_customization", JSON.stringify(customization));
  setPreferences({ customization });
}
