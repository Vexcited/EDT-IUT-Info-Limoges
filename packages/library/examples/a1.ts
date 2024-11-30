import { getLatestTimetableEntry, getTimetableFromBuffer, YEARS } from "../src";
// @ts-ignore
import fs from "node:fs";

void async function main () {
  // const entry = await getLatestTimetableEntry(YEARS.A1)
  // const buffer = await entry.getBuffer();
  // fs.writeFileSync("a1.pdf", Buffer.from(buffer));

  const buffer = await fs.promises.readFile("a1.pdf");
  const timetable = await getTimetableFromBuffer(buffer);

  if (timetable.header.week_number === 13 && timetable.lessons.length === 66) {
    console.info("\nSUCCESS");
  }
  else {
    console.error("\nFAILED", { wn: `${timetable.header.week_number} vs 13`, l: `${timetable.lessons.length} vs 66` });
  }
}()
