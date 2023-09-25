import type { TimetableLessonCM, TimetableLessonSAE, TimetableLessonTD, TimetableLessonTP } from "edt-iut-info-limoges";
import { type Component, For, createMemo, Show, Accessor } from "solid-js";
import type { ITimetable } from "~/types/api";

import { preferences } from "~/stores/preferences";
import { day } from "~/stores/temporary";

const Timetable: Component<ITimetable> = (props) => {
  // is the lesson is for today (look at the day)
  const lessons_of_today = createMemo(() => props.lessons
    .filter(lesson => {
      const isForDay = new Date(lesson.start_date).getDate() === day().getDate();
      if (!isForDay) return false;

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
    .sort((a, b) => {
      const aDate = new Date(a.start_date);
      const bDate = new Date(b.start_date);

      return aDate.getTime() - bDate.getTime();
    })
  );

  const Lesson: Component<{ lesson: ITimetable["lessons"][number], index: Accessor<number> }> = (props) => {
    const start_date = () => new Date(props.lesson.start_date);
    const end_date = () => new Date(props.lesson.end_date);

    const lesson_before = () => props.index() !== 0 ? lessons_of_today()[props.index() - 1] : null;

    return (
      <>
        <Show when={lesson_before() && start_date().getHours() !== new Date(lesson_before()!.end_date).getHours()}>
          <p class="py-4 text-subgray-1 text-center text-white border border-gray bg-gray my-2 ml-[58px]">
            Trou de {start_date().getHours() - new Date(lesson_before()!.end_date).getHours()}h !
          </p>
        </Show>


        <div class="flex gap-2">
          <div class="flex flex-col justify-between w-[50px] flex-shrink-0 text-right">
            <Show when={!lesson_before() || start_date().getHours() !== new Date(lesson_before()!.end_date).getHours()}
              fallback={<p>=</p>}
            >
              <p>
                {start_date().toLocaleString("fr", { minute: "2-digit", hour: "2-digit" })}
              </p>
            </Show>

            <p>
              {end_date().toLocaleString("fr", { minute: "2-digit", hour: "2-digit" })}
            </p>
          </div>

          <div class="border border-gray px-4 py-2 w-full flex-shrink-1"
            classList={{
              "border-t-none": Boolean(lesson_before()) && start_date().getHours() === new Date(lesson_before()!.end_date).getHours()
            }}
          >
            <p class="text-lg font-medium">{props.lesson.type} - {(props.lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP).content.type ?? "??"}</p>
            <Show when={(props.lesson as TimetableLessonCM).content.lesson}>
              {lesson => <p class="text-subgray-1">{lesson()}</p>}
            </Show>
            <p>En <span class="font-medium">{props.lesson.content.room}</span> avec {props.lesson.content.teacher}</p>
          </div>
        </div>
      </>
    )
  };

  return (
    <div class="max-w-[320px] w-full mx-auto">
      <For each={lessons_of_today()}>
        {(lesson, index) => <Lesson lesson={lesson} index={index} />}
      </For>
    </div>
  );
}

export default Timetable;
