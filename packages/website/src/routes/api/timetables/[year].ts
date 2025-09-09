import { type APIEvent } from "@solidjs/start/server";
import { YEARS } from "edt-iut-info-limoges";
import { jsonWithCors } from "~/utils/cors";

import type { ApiTimetableMeta } from "~/types/api";

import {
  connectDatabase,
  getCachedEntries,
  getCachedTimetable
} from "~/database";

export const GET = async ({ params }: APIEvent) => {
  const year = params.year as YEARS;

  if (Object.values(YEARS).indexOf(year) === -1) {
    return jsonWithCors({
      success: false,
      message: "Invalid year."
    }, 400);
  }

  const entries = await getCachedEntries(year);

  await connectDatabase();
  const timetables = await Promise.all(entries.map(
    entry => getCachedTimetable(entry)
  ));

  const metadataOfTimetables: ApiTimetableMeta["data"] = timetables.map(
    timetable => ({
      ...timetable.header,
      last_update: timetable.last_update
    })
  );

  return jsonWithCors({
    success: true,
    data: metadataOfTimetables
  }, 200);
};
