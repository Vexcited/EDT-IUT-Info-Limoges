import { getRawPDF } from "./utils/pdf.js";
import { getTimetable, type Timetable } from "./parser/index.js";

export const getTimetableFromBuffer = async (pdf_buffer: Buffer): Promise<Timetable> => {
  const pdf_raw_data = await getRawPDF(pdf_buffer);
  const pdf = pdf_raw_data.Pages[0];

  const timetable = getTimetable(pdf);
  return timetable;
};
