import { createStore } from "solid-js/store";
import { textColorOnCustomBackground } from "~/utils/colors";
import { getYearFromMainGroup } from "~/utils/groups";
import { safelyGetInLocalStorage } from "~/utils/localstorage";

interface UserCustomization {
  primary_color?: string
  use_fixed_height?: boolean
}

export const DEFAULT_USER_CUSTOMIZATION: Required<UserCustomization> = {
  primary_color: "255, 66, 66",
  use_fixed_height: false
};

export const [preferences, setPreferences] = createStore({
  get year(): number {
    return getYearFromMainGroup(this.main_group);
  },
  main_group: parseInt(safelyGetInLocalStorage("main_group", "1")),
  sub_group: parseInt(safelyGetInLocalStorage("sub_group", "0")) as 0 | 1,
  customization: JSON.parse(safelyGetInLocalStorage("user_customization", "{}")) as UserCustomization,
});

export const setMainGroup = (main_group: number) => {
  localStorage.setItem("main_group", main_group.toString());
  setPreferences({ main_group });
};

export const setSubGroup = (sub_group: 0 | 1) => {
  localStorage.setItem("sub_group", sub_group.toString());
  setPreferences({ sub_group });
};

export const setUserCustomization = (customization: UserCustomization) => {
  localStorage.setItem("user_customization", JSON.stringify(customization));
  setPreferences({ customization });
};

/**
 * Get the current user customization, or the default one if none is set.
 */
export const getUserCustomizationKey = <T extends keyof UserCustomization>(key: T): NonNullable<UserCustomization[T]> => {
  return preferences.customization[key] ?? DEFAULT_USER_CUSTOMIZATION[key];
};

export const textColorOnBG = (reversed = false) => textColorOnCustomBackground(getUserCustomizationKey("primary_color"), reversed);