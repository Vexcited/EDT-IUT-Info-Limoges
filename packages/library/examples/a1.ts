import { getTimetableFromBuffer, YEARS } from "../src";
// @ts-ignore
import fs from "node:fs";

void async function main () {
  // const entry = await getLatestTimetableEntry(YEARS.A1)
  // const buffer = await entry.getBuffer();
  // fs.writeFileSync("a1.pdf", buffer);

  const buffer = await fs.promises.readFile("a1.pdf");
  const timetable = await getTimetableFromBuffer(buffer);
  console.log("\nTERMINATED", { wn: timetable.header.week_number, l: timetable.lessons.length });
}()