import PDFParser, { type Output } from "pdf2json";

export const getRawPDF = async (pdf_buffer: Buffer): Promise<Output> => new Promise<Output>((resolve, reject) => {
  const parser = new PDFParser();

  parser.on("pdfParser_dataError", reject);
  parser.on("pdfParser_dataReady", resolve);

  parser.parseBuffer(pdf_buffer);
});
