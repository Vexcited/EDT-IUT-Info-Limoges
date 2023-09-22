import { type Component, For } from "solid-js";
import type { ITimetable } from "~/types/api";

import { preferences } from "~/stores/preferences";

const Timetable: Component<ITimetable> = (props) => {
  const today = new Date();
  const today_index = today.getDate();

  console.log(props.lessons)

  // is the lesson is for today (look at the day)
  const lessons_of_today = () => props.lessons.filter(
    lesson => new Date(lesson.start_date).getDate() === today_index
  ).filter(lesson => {
    let isForUser = false;
  
    switch (lesson.type) {
      case "TP":
        if (lesson.group.sub === preferences.sub_group && lesson.group.main === preferences.main_group) {
          isForUser = true;
        }
        break;

      // Since TD lessons are the whole group, we don't
      // need to check the subgroup.
      case "TD":
      case "SAE":
        if (lesson.group.main === preferences.main_group) {
          isForUser = true;
        }
        break;

      // Since CM lessons are for the whole year, we don't
      // need to check the group and subgroup.
      case "CM":
      case "OTHER":
        isForUser = true;
        break;
    }

    return isForUser;
  })

  const start_date = () => new Date(props.header.start_date);
  const end_date = () => new Date(props.header.end_date)

  return (
    <div>
      <For each={lessons_of_today()}>
        {lesson => (
          <div class="p-2">
            {new Date(lesson.start_date).toLocaleString("fr", { weekday: "short", minute: "2-digit", hour: "2-digit", day: "numeric", month: "long" })}
            <p>{lesson.type}: {lesson.content.room} avec {lesson.content.teacher}</p>
          </div>
        )}
      </For>
    </div>
  );
}

export default Timetable;
