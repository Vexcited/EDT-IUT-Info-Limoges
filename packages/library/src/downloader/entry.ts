import { DateTime } from "luxon";

import { STUDY_YEARS, FTP_ENDPOINT_URL } from "./constants";
import { DATE_TIME_OPTIONS } from "../utils/date";
import { getTimetableFromBuffer } from "../parser";

export class TimetableEntry {
  /** Includes the `.pdf` extension. */
  public file_name: string;
  /** Date displayed on the FTP, corresponds to the last update made to the file. */
  public last_updated: DateTime;
  /** From the beginning of the school year. Usually starts from September. */
  public week_number: number;
  public from_year: STUDY_YEARS;
  /** The direct link to the timetable. */
  public link: string

  /**
   * @param file_name - format: A{from_year}_S{week_number}.pdf
   * @param raw_date - format: yyyy-MM-dd HH:mm
   */
  constructor (file_name: string, raw_date: string) {
    this.file_name = file_name;
    this.last_updated = DateTime.fromFormat(raw_date, "yyyy-MM-dd HH:mm", DATE_TIME_OPTIONS);
    this.week_number = parseInt(file_name.replace(/(A(.*)_S)|(.pdf)/g, ""));
    this.from_year = ("A" + file_name[1]) as STUDY_YEARS;
    this.link = `${FTP_ENDPOINT_URL}/${this.from_year}/${this.file_name}`;
  }

  /**
   * @returns The timetable's PDF as a buffer.
   */
  async getBuffer () {
    const response = await fetch(this.link);
    const array = await response.arrayBuffer();
    return Buffer.from(array);
  }

  /**
   * @returns The timetable's content parsed.
   */
  async getTimetable () {
    const buffer = await this.getBuffer();
    const timetable = await getTimetableFromBuffer(buffer);
    return timetable;
  }
}