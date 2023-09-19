import PDFParser from "pdf2json";

import path from "node:path";
import fs from "node:fs";

/** Colors are all in lowercase. */
const COLORS = {
  CM: "#ffff0c",
  TD: "#ffbab3",
  TP: "#b3ffff",

  RULERS: "#ffffa7",
  HEADER: "#64ccff"
}

const parser = new PDFParser();

// This is where we'll store the extracted data from the PDF.
const output = {
  cm: [],
}

// parser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
parser.on("pdfParser_dataReady", (raw_data) => {
  const creation_date = raw_data.Meta.CreationDate;
  const pdf = raw_data.Pages[0];

  for (const fill of pdf.Fills) {
    // We only care about the fills that have a color.
    if (!fill.oc) continue;

    const color = fill.oc.toLowerCase();
    // We only care about the colors that are in our COLORS object.
    if (!Object.values(COLORS).includes(color)) continue;

    const fill_bounds = {
      start_x: fill.x,
      start_y: fill.y,
      end_x: fill.x + fill.w,
      end_y: fill.y + fill.h
    };

    const contained_texts = pdf.Texts.filter(text => {
      const x_in_bounds = text.x >= fill_bounds.start_x && text.x <= fill_bounds.end_x;
      const y_in_bounds = text.y >= fill_bounds.start_y && text.y <= fill_bounds.end_y;

      return x_in_bounds && y_in_bounds;
    });

    const parsed_texts = contained_texts.map(text => {
      return decodeURIComponent(text.R[0].T);
    });

    switch (color) {
      case COLORS.CM:
        output.cm.push({
          bounds: fill_bounds,
          parsed_texts
        });
        break;
    }
  }

  console.log(JSON.stringify(output, null, 2));
  fs.writeFileSync("./tests/A1_S3.json", JSON.stringify(pdf, null, 2));
});

// We get the buffer of the PDF file.
const buffer = fs.readFileSync(new URL("./A1_S3.pdf", import.meta.url));
parser.parseBuffer(buffer);
