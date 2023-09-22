import { createStore } from "solid-js/store";

const [preferences, setPreferences] = createStore({
  main_group: parseInt(localStorage.getItem("main_group") ?? "1"),
  sub_group: parseInt(localStorage.getItem("sub_group") ?? "0")
});

const setMainGroup = (main_group: number) => {
  localStorage.setItem("main_group", main_group.toString());
  setPreferences({ main_group });
}

const setSubGroup = (sub_group: number) => {
  localStorage.setItem("sub_group", sub_group.toString());
  setPreferences({ sub_group });
}

export { preferences, setMainGroup, setSubGroup }
