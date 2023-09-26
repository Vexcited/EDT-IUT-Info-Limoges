# [`edt-iut-info-limoges`](https://www.npmjs.com/package/edt-iut-info-limoges)

> A Node.js library to get the schedule of the [IUT Informatique of Limoges](https://iut.unilim.fr).

1. [Installation](#installation)
2. [Examples](#examples)
3. [API](#api)
4. [Credits](#credits)

## Installation

You can install this library via your favorite package manager.

```bash
# pnpm
pnpm add edt-iut-info-limoges

# Yarn
yarn add edt-iut-info-limoges

# npm
npm install edt-iut-info-limoges --save
```

TypeScript types are included in this package.

## Examples

### Get available timetables for a specified year

> Here, we'll use year `A1`.

```typescript
import { YEARS, getTimetableEntries } from "edt-iut-info-limoges";

// Get all the timetable entries for the year A1.
const timetables = await getTimetableEntries(YEARS.A1);
```

`timetables` will be an array of [`TimetableEntry`](#timetableentry) objects **sorted by their property `week_number`**.

### Get the latest timetable for a specified year and parse it

> Here, we'll use year `A1`.

```typescript
import { YEARS, getLatestTimetableEntry } from "edt-iut-info-limoges";

// Get the latest timetable entry for the year A1.
const timetableEntry = await getLatestTimetableEntry(YEARS.A1);

// Parse the timetable from the timetable entry.
// Internally, will fetch the buffer of the PDF file and parse it.
const timetable = await timetableEntry.getTimetable();
```

Since the timetables are sorted by their `week_number` property, the latest timetable will be the last entry of the `getTimetableEntries()` array.

`timetableEntry` will be a [`TimetableEntry`](#timetableentry) object and `timetable` will be a [`Timetable`](#timetable) interface.

### Parse a timetable from its buffer

> Here, we'll get a timetable entry and get its buffer to later parse it.
>
> You can of course, provide your own buffer, from another source, here it's just to demonstrate.

```typescript
import { YEARS, getLatestTimetableEntry, getTimetableFromBuffer } from "edt-iut-info-limoges";

const timetableEntry = await getLatestTimetableEntry(YEARS.A1);
// Fetch the PDF file and return the buffer.
const pdfBuffer = await timetableEntry.getBuffer();

// Parse the timetable from the buffer.
const timetable = getTimetableFromBuffer(pdfBuffer);
```

`timetable` will be a [`Timetable`](#timetable) interface.

### Get the lessons for a specified group and subgroup

> Here, we'll be `G1A`, so group `1` and subgroup `A`.

```typescript
import { getLatestTimetableEntry, YEARS, SUBGROUPS, LESSON_TYPES } from "edt-iut-info-limoges";

const timetableEntry = await getLatestTimetableEntry(YEARS.A1);
const timetable = await timetableEntry.getTimetable();

const lessonsForG1A = timetable.lessons.filter(lesson => {
  let isForG1A = false;
  
  switch (lesson.type) {
    case LESSON_TYPES.TP:
      // We only want to keep the TP lessons that are
      // for the subgroup A and the group 1.
      if (lesson.group.sub === SUBGROUPS.A && lesson.group.main === 1) {
        isForG1A = true;
      }
      break;

    // Since TD lessons are the whole group, we don't
    // need to check the subgroup.
    case LESSON_TYPES.TD:
      // We only want to keep the TD lessons that are
      // for the group 1.
      if (lesson.group.main === 1) {
        isForG1A = true;
      }
      break;

    // Since CM lessons are for the whole year, we don't
    // need to check the group and subgroup.
    case LESSON_TYPES.CM:
      isForG1A = true;
      break;
  }

  return isForG1A;
});
```

Note that we're not checking for `SAE` and potential `OTHER` lessons.

## API

### `YEARS`

An helper enum containing all the available years.

```typescript
import { YEARS } from "edt-iut-info-limoges";

console.log(YEARS.A1); // "A1"
console.log(YEARS.A2); // "A2"
console.log(YEARS.A3); // "A3"
```

### `SUBGROUPS`

An helper enum containing all the available subgroups.

In the API, the subgroups are represented by a number while they are represented by a letter in real life. This enum is here to help you convert the letters to numbers.

```typescript
import { SUBGROUPS } from "edt-iut-info-limoges";

console.log(SUBGROUPS.A); // 0
console.log(SUBGROUPS.B); // 1
```

### `LESSON_TYPES`

An helper enum containing all the available lesson types.

You can use this enum to filter the lessons using their `type` property.

```typescript
import { LESSON_TYPES } from "edt-iut-info-limoges";

console.log(LESSON_TYPES.CM); // "CM"
console.log(LESSON_TYPES.TD); // "TD"
console.log(LESSON_TYPES.TP); // "TP"
console.log(LESSON_TYPES.SAE); // "SAE"
console.log(LESSON_TYPES.OTHER); // "OTHER", used for unknown lessons
```

### `TimetableEntry`

A class representing a timetable entry.

```typescript
interface TimetableEntry {
  // Includes the `.pdf` extension.
  file_name: string;
  // Date displayed on the FTP, corresponds to the last update made to the file.
  // Where DateTime is a class from the `luxon` package.
  last_updated: DateTime;
  // From the beginning of the school year. Usually starts from September.
  week_number: number;
  // The year specified to get the entry, eg.: `A1`.
  from_year: YEARS;
  /** The direct link to the timetable. */
  link: string;

  // Fetch the buffer of the PDF file and returns it.
  getBuffer(): Promise<Buffer>;
  // Fetch the buffer of the PDF file, parse it and returns the timetable.
  getTimetable(): Promise<Timetable>;
} 
```

Can be obtained using the `getTimetableEntries()` and `getLatestTimetableEntry()` functions.

### `Timetable`

An interface representing a timetable.

```typescript
interface Timetable {
  header: {
    // Week number from September.
    week_number: number;
    // Week number from the beginning of the year.
    week_number_in_year: number;
  
    // DateTime is a class from the `luxon` package.
    // The date of the first day of the week.
    start_date: DateTime;
    // The date of the last day of the week.
    end_date: DateTime;
  }

  // The lessons of the timetable.
  lessons: TimetableLesson[];
}
```

### `TimetableLesson`

An interface representing a lesson.

You can use the `type` property to filter the lessons using the [`LESSON_TYPES`](#lesson_types) enum. Each lesson type has its own properties.

```typescript
interface TimetableLessonCM {
  type: LESSON_TYPES.CM;

  content: {
    // eg.: "R1.01"
    type: string;
    // Name of the lesson (eg.: "Initiation au développement") from the parsed timetable.
    raw_lesson: string;
    // Lesson name in the official reference.
    lesson_from_reference?: string;
    // Name of the teacher
    teacher: string;
    // eg.: "AC"
    room: string;
  }
}

interface TimetableLessonTP {
  type: LESSON_TYPES.TP;

  // eg.: If you're in G1A, `main` will be `1` and the
  //      subgroup will be `SUBGROUPS.A` (where `SUBGROUPS.A === 0`)
  group: {
    main: number;
    sub: SUBGROUPS;
  }

  content: {
    // eg.: "R1.01"
    type: string;
    // Name of the teacher
    teacher: string;
    // eg.: "105"
    room: string;
    // Lesson name in the official reference.
    lesson_from_reference?: string;
  }
}

interface TimetableLessonTD {
  type: LESSON_TYPES.TD;

  // eg.: If you're in G1, `main` will be `1`.
  group: {
    main: number;
  }

  content: {
    // eg.: "R1.01"
    type: string;
    // Name of the teacher
    teacher: string;
    // eg.: "204"
    room: string;
    // Lesson name in the official reference.
    lesson_from_reference?: string;
  }
}

interface TimetableLessonSAE {
  type: LESSON_TYPES.SAE;

  // eg.: If you're in G1, `main` will be `1`.
  group: {
    main: number;
  }

  content: {
    // eg.: "S1.01"
    type: string;
    // Most of the time, it's the group name.
    teacher: string;
    // Lesson name in the official reference.
    lesson_from_reference?: string;
    // Lesson name parsed in the timetable, if exists.
    raw_lesson?: string;
    // eg.: "204"
    room: string;
  }
}

interface TimetableLessonOTHER {
  type: LESSON_TYPES.OTHER;

  content: {
    description: string;
    teacher: string;
    room: string;
  }
}

// The final type of a lesson.
type TimetableLesson = {
  start_date: DateTime;
  end_date: DateTime;
} & (
  | TimetableLessonCM
  | TimetableLessonTP
  | TimetableLessonTD
  | TimetableLessonSAE
  | TimetableLessonOTHER
);
```

## Credits

This project wouldn't have been possible without them.

- [IUT Informatique of Limoges](https://iut.unilim.fr) for existing ;
- [`pdf2json`](https://github.com/modesty/pdf2json) that [I forked](./src/converter/) for parsing the PDF files ;
- [`pdf.js`](https://github.com/mozilla/pdf.js) that is used by `pdf2json` ;
- [`luxon`](https://github.com/moment/luxon) for parsing the dates.
