import { DateTime } from "luxon";

import { YEARS, FTP_ENDPOINT_URL } from "./constants";
import { DATE_TIME_OPTIONS } from "../utils/date";
import { getTimetableFromBuffer } from "../parser";

export class TimetableEntry {
  /** Includes the `.pdf` extension. */
  public file_name: string;
  /** Date displayed on the FTP, corresponds to the last update made to the file. */
  public last_updated: DateTime;
  /** From the beginning of the school year. Usually starts from September. */
  public week_number: number;
  public from_year: YEARS;
  /** The direct link to the timetable. */
  public link: string

  private response_buffer: ArrayBuffer | undefined;
  private response_headers: Headers | undefined;

  /**
   * @param file_name - format: A{from_year}_S{week_number}.pdf
   * @param raw_date - format: yyyy-MM-dd HH:mm
   */
  constructor(file_name: string, raw_date: string) {
    this.file_name = file_name;
    this.last_updated = DateTime.fromFormat(raw_date, "yyyy-MM-dd HH:mm", DATE_TIME_OPTIONS);
    this.week_number = parseInt(file_name.replace(/(A(.*)_S)|(.pdf)/g, ""));
    this.from_year = ("A" + file_name[1]) as YEARS;
    this.link = `${FTP_ENDPOINT_URL}/${this.from_year}/${this.file_name}`;
  }

  private async retrieveResponseFields(): Promise<void> {
    if (!this.response_headers && !this.response_buffer) {
      const response = await fetch(this.link);

      this.response_headers = response.headers;
      this.response_buffer = await response.arrayBuffer();
    }
  }

  /**
   * @returns The timetable's PDF as a buffer.
   */
  public async getBuffer(): Promise<ArrayBuffer> {
    await this.retrieveResponseFields();
    return this.response_buffer!;
  }

  /**
   * @returns The timetable's content parsed.
   */
  public async getTimetable() {
    const buffer = await this.getBuffer();
    const timetable = await getTimetableFromBuffer(buffer);
    return timetable;
  }

  /**
   * @returns The date of the last update made to the file.
   */
  public async lastUpdated(): Promise<DateTime> {
    await this.retrieveResponseFields();
    const last_updated = this.response_headers!.get("Last-Modified");
    if (!last_updated) {
      throw new Error("Could not get date from \"Last-Modified\" header, probably not existant.");
    }

    return DateTime.fromHTTP(last_updated);
  }
}
