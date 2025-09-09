import { createEvents } from "ics";
import type { ITimetable } from "~/types/api";
import { preferences } from "~/stores/preferences";
import { TimetableLessonCM, TimetableLessonOTHER, TimetableLessonSAE, TimetableLessonTD, TimetableLessonTP, TimetableLessonDS } from "edt-iut-info-limoges";
import { lessonsForSubGroup } from "./lessons";

export const generateICS = (timetable: Omit<ITimetable, "last_update">): void => {
  const lessons = lessonsForSubGroup(timetable, {
    main_group: preferences.main_group,
    sub_group: preferences.sub_group
  });

  const { error, value } = createEvents(lessons.map(lesson => {
    const start = new Date(lesson.start_date);
    const end = new Date(lesson.end_date);

    const content = (lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP | TimetableLessonDS).content.lesson_from_reference || (lesson as TimetableLessonCM | TimetableLessonSAE).content.raw_lesson || (lesson as TimetableLessonOTHER).content.description;

    return {
      title: lesson.type + " - " + ((lesson as TimetableLessonCM | TimetableLessonSAE | TimetableLessonTD | TimetableLessonTP | TimetableLessonDS).content.type ?? "??") + " - " + content,
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
    alert("Une erreur s'est produit lors de la génération du fichier ICS, voir la console.");
    console.error(error);
    return;
  }

  const filename = "A" + preferences.year.toString() + "_G" + preferences.main_group.toString() + (preferences.sub_group === 0 ? "A" : "B") + "_S" + timetable.header.week_number + ".ics";
  const file = new File([value], filename, { type: "text/calendar" });

  const url = URL.createObjectURL(file);

  // trying to assign the file URL to a window could cause cross-site
  // issues so this is a workaround using HTML5
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
};
