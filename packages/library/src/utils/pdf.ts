import PDFParser, { type Output } from "../converter/pdfparser.js";

export const getRawPDF = async (pdf_buffer: Buffer): Promise<Output> => new Promise<Output>((resolve, reject) => {
  const parser = new PDFParser();

  parser.on("pdfParser_dataError", reject);
  parser.on("pdfParser_dataReady", resolve);

  parser.parseBuffer(pdf_buffer);
});
