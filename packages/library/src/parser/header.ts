import type { Page } from "../converter/pdfparser.js";

import { type FillBounds, getFillBounds, getTextsInFillBounds } from "./bounds.js";
import { COLORS } from "./constants.js";

import { DateTime, type DateTimeOptions } from "luxon";

export interface TimetableHeader {
  data: {
    week_number: number;
    week_number_in_year: number;
  
    start_date: DateTime;
    end_date: DateTime;
  },

  bounds: FillBounds
}

const DATE_TIME_FORMAT = "dd/MM/yyyy";
const DATE_TIME_OPTIONS: DateTimeOptions = { locale: "fr", zone: "Europe/Paris" };

export const getTimetableHeader = (page: Page): TimetableHeader => {
  const header_fill = page.Fills.find(fill => fill.oc === COLORS.HEADER);
  if (!header_fill) throw new Error("Can't find header fill.");

  const header_fill_bounds = getFillBounds(header_fill);
  const header_texts = getTextsInFillBounds(page, header_fill_bounds);
  if (header_texts.length === 0) throw new Error("Can't find header texts.");

  // Under the format: "EMPLOI DU TEMPS - Semaine X (Y) : du dd/MM/yyyy au dd/MM/yyyy        -- Date et heure de création : dd/MM/yyyy -- HH:mm:ss --"
  const header_text = decodeURIComponent(header_texts[0].R[0].T);

  // We only care about the part "Semaine X (Y) : du dd/MM/yyyy au dd/MM/yyyy"
  const header_week_text = header_text.split("-")[1].trim();
  const header_text_matches = header_week_text.match(/Semaine (\d+) \((\d+)\) : du (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);
  if (!header_text_matches) throw new Error("Can't parse header text.");

  // Parse the dates.
  const week_start_date = DateTime.fromFormat(header_text_matches[3], DATE_TIME_FORMAT, DATE_TIME_OPTIONS);
  const week_end_date = DateTime.fromFormat(header_text_matches[4], DATE_TIME_FORMAT, DATE_TIME_OPTIONS);

  return {
    bounds: header_fill_bounds,

    data: {
      week_number: parseInt(header_text_matches[1]),
      week_number_in_year: parseInt(header_text_matches[2]),
      
      start_date: week_start_date,
      end_date: week_end_date
    }
  };
};
