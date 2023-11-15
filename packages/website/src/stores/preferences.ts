import { createStore } from "solid-js/store";

const [preferences, setPreferences] = createStore({
  year: parseInt(localStorage.getItem("year") ?? "1"),
  main_group: parseInt(localStorage.getItem("main_group") ?? "1"),
  sub_group: parseInt(localStorage.getItem("sub_group") ?? "0") as 0 | 1,
  current_week: parseInt(localStorage.getItem("current_week") ?? "-1")
});

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

const setCurrentWeek = (week_number: number) => {
  localStorage.setItem("current_week", week_number.toString());
  setPreferences({ current_week: week_number });
}

export { preferences, setYear, setMainGroup, setSubGroup, setCurrentWeek }
