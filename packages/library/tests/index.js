import fs from "node:fs";
import { getTimetableFromBuffer } from "../dist/index.js";

const buffer = fs.readFileSync(new URL("./A1_S3.pdf", import.meta.url));
const timetable = await getTimetableFromBuffer(buffer);

console.log(JSON.stringify(timetable, null, 2));
fs.writeFileSync(new URL("./A1_S3.json", import.meta.url), JSON.stringify(timetable, null, 2));
