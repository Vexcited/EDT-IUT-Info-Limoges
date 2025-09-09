import type { ITimetableHeader } from "~/types/api";
import { DateTime } from "luxon";
import { now } from "~/stores/temporary";

/**
 * @returns - In format "(H)H" + "h" + ("(m)m" if not 0)
 */
export const hoursAndMinutesBetween = (timeEnd: Date, timeStart: Date): string => {
  const hourDiff = timeEnd.getTime() - timeStart.getTime();
  const minDiff = hourDiff / 60 / 1000;
  const hDiff = hourDiff / 3600 / 1000;

  const output = {
    hours: Math.floor(hDiff),
    minutes: 0
  };

  output.minutes = minDiff - 60 * output.hours;

  // When it's only about the minutes
  // we don't need to show the hours.
  if (output.hours === 0) {
    return output.minutes + " minute" + (output.minutes > 1 ? "s" : "");
  }

  return output.hours + "h" + (output.minutes ? output.minutes : "");
};

export const getDayFromTimetable = (timetable_header: ITimetableHeader, index: number): Date => {
  const start_week_day = new Date(timetable_header.start_date);
  // according to the day index, get the right day
  const day = new Date(start_week_day.setDate(start_week_day.getDate() + index));

  return day;
};

export const getDayString = (day: Date) => {
  const date = DateTime.fromJSDate(day);
  let relativeDate = date.setLocale("fr").toRelativeCalendar()!;

  // upper case the day of the week
  relativeDate = relativeDate[0].toUpperCase() + relativeDate.slice(1);

  let fullDate = day.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit"
  });

  // upper case the day of the week
  fullDate = fullDate[0].toUpperCase() + fullDate.slice(1);

  return `${relativeDate} : ${fullDate}`;
};

export const getSmolDayString = (day: Date) => day.toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

export const getHourString = (date: Date) => date.toLocaleString("fr", {
  minute: "2-digit",
  hour: "2-digit"
});

export const getGreeting = () => {
  const n = now();
  const hour = n.hour;
  const mins = n.minute;

  if (hour > 5 && hour <= 7) return "Bonjour !";
  else if (hour > 7 && hour <= 11) return "Bonne matinée !";
  else if (hour > 11 && (hour <= 13 && mins <= 30)) return "Bon appétit !";
  else if (((hour == 13 && mins >=30) || (hour > 13)) && hour <= 17) return "Bon après-midi !";
  else if (hour > 17 && hour <= 22) return "Bonsoir !";
  else if (hour > 22 || hour <= 5) return "Bonne nuit !";
};

/**
 * @see <https://stackoverflow.com/a/6117889>
 * @param d - The date we want to take the week number from.
 * @returns - The week number of the given date.
 */
export const getWeekNumber = (d: Date) => {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((
    (
      (d.getTime() - yearStart.getTime()) / 86400000
    ) + 1
  ) / 7);

  return weekNo;
};

export const getRelativeRemainingTime = (now: DateTime, end: DateTime): string => {
  const diff = end.diff(now, ["hours", "minutes"]).toObject();

  const hours = Math.floor(diff.hours ?? 0);
  const minutes = Math.floor(diff.minutes ?? 0);

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}
