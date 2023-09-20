import PDFParser from "../src/pdf/pdfparser.js";
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
  header: {},
  cm: [],
  td: [],
  tp: []
};

const getBounds = (fill) => ({
  start_x: fill.x,
  start_y: fill.y,
  end_x: fill.x + fill.w,
  end_y: fill.y + fill.h
});

const getTextsInBounds = (pdf, bounds, end_y_offset = 0) => pdf.Texts.filter(text => {
  const x_in_bounds = text.x >= bounds.start_x && text.x <= bounds.end_x;
  const y_in_bounds = text.y >= bounds.start_y && text.y <= (bounds.end_y + end_y_offset);

  return x_in_bounds && y_in_bounds;
});

// parser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
parser.on("pdfParser_dataReady", (raw_data) => {
  // const creation_date = raw_data.Meta.CreationDate;
  const pdf = raw_data.Pages[0];

  const header_fill = pdf.Fills.find(fill => fill.oc === COLORS.HEADER);
  if (!header_fill) throw new Error("Can't find header fill.");

  const header_fill_bounds = getBounds(header_fill);
  // Under the format: "EMPLOI DU TEMPS - Semaine X (Y) : du DD/MM/YYYY au DD/MM/YYYY        -- Date et heure de création : DD/MM/YYYY -- HH:mm:ss --"
  const header_text = decodeURIComponent(getTextsInBounds(pdf, header_fill_bounds)[0].R[0].T);
  // We only care about the part "Semaine X (Y) : du DD/MM/YYYY au DD/MM/YYYY"
  const header_week_text = header_text.split("-")[1].trim();
  const header_text_matches = header_week_text.match(/Semaine (\d+) \((\d+)\) : du (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);
  if (!header_text_matches) throw new Error("Can't parse header text.");

  output.header = {
    week_number: header_text_matches[1],
    week_number_in_year: header_text_matches[2],
    start_date: header_text_matches[3],
    end_date: header_text_matches[4],
  };

  for (const fill of pdf.Fills) {
    // We only care about the fills that have a color.
    if (!fill.oc) continue;

    const color = fill.oc.toLowerCase();
    // We only care about the colors that are in our COLORS object.
    if (!Object.values(COLORS).includes(color)) continue;

    const fill_bounds = getBounds(fill);
    const contained_texts = getTextsInBounds(pdf, fill_bounds, 5);

    const parsed_texts = contained_texts.map(text => {
      return decodeURIComponent(text.R[0].T);
    });

    switch (color) {
      case COLORS.CM: {
        const type = parsed_texts.shift().split(" -")[0];
        const room = parsed_texts.pop();
        
        let teacher = parsed_texts.pop();
        // It can happen that for some reason, the room is duplicated.
        if (teacher === room) {
          teacher = parsed_texts.pop();
        }

        const lesson = parsed_texts.map(text => text.trim()).join(" ");

        output.cm.push({
          // start_x: fill_bounds.start_x,
          // end_x: fill_bounds.end_x,

          content: { type, lesson, teacher, room }
        });

        break;
      }
    }
  }

  console.log(JSON.stringify(output, null, 2));
  fs.writeFileSync("./tests/A1_S3.json", JSON.stringify(pdf, null, 2));
});

// We get the buffer of the PDF file.
const buffer = fs.readFileSync(new URL("./A1_S3.pdf", import.meta.url));
parser.parseBuffer(buffer);
