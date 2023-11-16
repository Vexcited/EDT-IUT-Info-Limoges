import { createStore } from "solid-js/store";

export interface UserCustomization {
  primary_color?: string
}

const DEFAULT_USER_CUSTOMIZATION: Required<UserCustomization> = {
  primary_color: "248, 113, 113"
}

let setPreferences, preferences;
export const initializePreferencesStore = () => {
  const [preferences2, setPreferences2] = createStore({
    year: parseInt(localStorage.getItem("year") ?? "1"),
    main_group: parseInt(localStorage.getItem("main_group") ?? "1"),
    sub_group: parseInt(localStorage.getItem("sub_group") ?? "0") as 0 | 1,
    customization: JSON.parse(localStorage.getItem("user_customization") ?? "{}") as UserCustomization,
  });

  preferences = preferences2;
  setPreferences = setPreferences2;
}

const setYear = (year: number) => {
  localStorage.setItem("year", year.toString());
  setPreferences({ year });
};

const setMainGroup = (main_group: number) => {
  localStorage.setItem("main_group", main_group.toString());
  setPreferences({ main_group });
}

const setSubGroup = (sub_group: 0 | 1) => {
  localStorage.setItem("sub_group", sub_group.toString());
  setPreferences({ sub_group });
}

const setUserCustomization = (customization: UserCustomization) => {
  localStorage.setItem("user_customization", JSON.stringify(customization));
  setPreferences({ customization });
}

export { preferences, setYear, setMainGroup, setSubGroup, setUserCustomization, DEFAULT_USER_CUSTOMIZATION }
