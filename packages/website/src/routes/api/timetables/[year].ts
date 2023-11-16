import { type APIEvent, json } from "solid-start/api";
import { YEARS } from "edt-iut-info-limoges";

import type { ApiTimetableMeta } from "~/types/api";

import {
  connectDatabase,
  getCachedEntries,
  getCachedTimetable
} from "~/database";

export const GET = async ({ params }: APIEvent) => {
  const year = params.year as YEARS;

  if (Object.values(YEARS).indexOf(year) === -1) {
    return json({
      success: false,
      message: "Invalid year."
    }, { status: 400 });
  }

  const entries = await getCachedEntries(year);

  await connectDatabase();
  const timetables = await Promise.all(entries.map(
    entry => getCachedTimetable(entry)
  ));

  const metas: ApiTimetableMeta["data"] = timetables.map(
    timetable => ({
      ...timetable.header,
      last_update: timetable.last_update
    })
  );

  return json({
    success: true,
    data: metas
  });
};
