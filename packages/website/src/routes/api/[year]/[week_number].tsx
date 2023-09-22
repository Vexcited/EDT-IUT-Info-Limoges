import { type APIEvent, json } from "solid-start/api";
import { YEARS, getTimetableEntries } from "edt-iut-info-limoges";

export const GET = async ({ params }: APIEvent) => {
  const year = params.year as YEARS;
  const week_number = params.week_number as string;

  if (Object.values(YEARS).indexOf(year) === -1) {
    return json({
      success: false,
      message: "Invalid year."
    }, { status: 400 });
  }

  const entries = await getTimetableEntries(year);
  const entry = entries.find(entry => entry.week_number === parseInt(week_number));

  if (!entry) return json({
    success: false,
    message: "Can't find the entry."
  }, { status: 404 });

  const timetable = await entry.getTimetable();

  return json({
    success: true,
    data: timetable
  });
}