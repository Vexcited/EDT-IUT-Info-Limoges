import { createEvents } from "ics";
import type { ITimetable } from "~/types/api";
import { preferences } from "~/stores/preferences";
import { TimetableLessonCM, TimetableLessonOTHER, TimetableLessonSAE, TimetableLessonTD, TimetableLessonTP } from "edt-iut-info-limoges";

export const generateICS = (timetable: ITimetable) => {
  const lessons = timetable.lessons.filter(lesson => {
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
        if (typeof lesson.group === "undefined" || lesson.group.main === preferences.main_group) {
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
  // Remove the lessons that are the same as the previous one
  // (like same type, same room, same teacher, but with just a +1 index difference in the array)
  // Also update the `end_date` of the previous lesson to the `end_date` of the current lesson.
  .reduce((acc, lesson, index, array) => {
    const previousLesson = array[index - 1];

    if (previousLesson) {
      const previousLessonDate = new Date(previousLesson.start_date);
      const lessonDate = new Date(lesson.start_date);
      
      // if not same day, we should not merge them.
      if (previousLessonDate.getDate() !== lessonDate.getDate()) {
        acc.push(lesson);
        return acc;
      }
    }

    if (previousLesson && previousLesson.type === lesson.type && previousLesson.content.room === lesson.content.room && previousLesson.content.teacher === lesson.content.teacher) {
      previousLesson.end_date = lesson.end_date;
    }
    else {
      acc.push(lesson);
    }

    return acc;
  }, [] as ITimetable["lessons"])

  const { error, value } = createEvents(lessons.map(lesson => {
    const start = new Date(lesson.start_date);
    const end = new Date(lesson.end_date);

    const content = (lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP).content.lesson_from_reference || (lesson as TimetableLessonCM | TimetableLessonSAE).content.raw_lesson || (lesson as TimetableLessonOTHER).content.description;

    return {
      title: lesson.type + " - " + ((lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP).content.type ?? "??") + " - " + content,
      description: `
${content}
Avec ${lesson.content.teacher} en salle ${lesson.content.room}.
      `.trim(),

      start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
      end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()],
      location: lesson.content.room
    };
  }));

  if (error || !value) {
    console.error(error);
    alert("Une erreur s'est produit lors de la génération du fichier ICS.");
    return;
  }

  const filename = "A" + preferences.year.toString() + "_G" + preferences.main_group.toString() + (preferences.sub_group === 0 ? "A" : "B") + "_S" + timetable.header.week_number + ".ics";
  const file = new File([value], filename, { type: 'text/calendar' });

  const url = URL.createObjectURL(file);

  // trying to assign the file URL to a window could cause cross-site
  // issues so this is a workaround using HTML5
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
};
