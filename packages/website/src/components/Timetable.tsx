import { type Component, For } from "solid-js";
import type { ITimetable } from "~/types/api";

const Timetable: Component<ITimetable> = (props) => {
  const today = new Date();
  const today_index = today.getDate();

  // is the lesson is for today (look at the day)
  const lessons_of_today = () => props.lessons.filter(
    lesson => new Date(lesson.start_date).getDate() === today_index
  );

  const start_date = () => new Date(props.header.start_date);
  const end_date = () => new Date(props.header.end_date)

  return (
    <div>
      <For each={lessons_of_today()}>
        {lesson => (
          <div>
            <p>{new Date(lesson.start_date).getHours()}:{new Date(lesson.start_date).getMinutes()}</p>
            <p>{lesson.content.room}</p>
          </div>
        )}
      </For>
    </div>
  );
}

export default Timetable;
