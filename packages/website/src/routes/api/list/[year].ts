import { type APIEvent, json } from "solid-start/api";
import { YEARS, getTimetableEntries } from "edt-iut-info-limoges";

export const GET = async ({ params }: APIEvent) => {
  const year = params.year as YEARS;

  if (Object.values(YEARS).indexOf(year) === -1) {
    return json({
      success: false,
      message: "Invalid year."
    }, { status: 400 });
  }

  const entries = await getTimetableEntries(year);
  return json({
    success: true,
    data: entries
  });
};
