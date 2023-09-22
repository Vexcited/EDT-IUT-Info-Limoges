import { createStore } from "solid-js/store";

const [preferences, setPreferences] = createStore({
  year: parseInt(localStorage.getItem("year") ?? "1"),
  main_group: parseInt(localStorage.getItem("main_group") ?? "1"),
  sub_group: parseInt(localStorage.getItem("sub_group") ?? "0")
});

const setYear = (year: number) => {
  localStorage.setItem("year", year.toString());
  setPreferences({ year });
};

const setMainGroup = (main_group: number) => {
  localStorage.setItem("main_group", main_group.toString());
  setPreferences({ main_group });
}

const setSubGroup = (sub_group: number) => {
  localStorage.setItem("sub_group", sub_group.toString());
  setPreferences({ sub_group });
}

export { preferences, setYear, setMainGroup, setSubGroup }
