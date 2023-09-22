import { type Component, For } from "solid-js";
import type { ITimetable } from "~/types/api";

const Timetable: Component<ITimetable> = (props) => {
  const today = new Date();
  const today_index = today.getDate();

  console.log(props.lessons)

  // is the lesson is for today (look at the day)
  const lessons_of_today = () => props.lessons.filter(
    lesson => new Date(lesson.start_date).getDate() === today_index
  ).filter(lesson => {
    let isForG1A = false;
  
    switch (lesson.type) {
      case "TP":
        // We only want to keep the TP lessons that are
        // for the subgroup A and the group 1.
        if (lesson.group.sub === 0 && lesson.group.main === 1) {
          isForG1A = true;
        }
        break;

      // Since TD lessons are the whole group, we don't
      // need to check the subgroup.
      case "TD":
        // We only want to keep the TD lessons that are
        // for the group 1.
        if (lesson.group.main === 1) {
          isForG1A = true;
        }
        break;

      // Since CM lessons are for the whole year, we don't
      // need to check the group and subgroup.
      case "CM":
        isForG1A = true;
        break;
    }

    return isForG1A;

  })

  const start_date = () => new Date(props.header.start_date);
  const end_date = () => new Date(props.header.end_date)

  return (
    <div>
      <For each={lessons_of_today()}>
        {lesson => (
          <div>
            {lesson.start_date}
            <p>{new Date(lesson.start_date).getHours()}:{new Date(lesson.start_date).getMinutes().toString().padStart(2, "0")}</p>
            <p>{lesson.type}: {lesson.content.room}</p>
          </div>
        )}
      </For>
    </div>
  );
}

export default Timetable;
