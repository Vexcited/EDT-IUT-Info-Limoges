import type { Output } from "../converter/types";
import PDFParser from "../converter";

// export const getRawPDF = async (pdf_buffer: ArrayBuffer): Promise<Output> => {
//   const parser = new PDFParser();
//   return parser.parseBuffer(new Uint8Array(pdf_buffer));
// }

export const getRawPDF = async (pdf_buffer: ArrayBuffer): Promise<Output> => new Promise<Output>((resolve, reject) => {
  const parser = new PDFParser();

  parser.on("pdfParser_dataError", reject);
  parser.on("pdfParser_dataReady", resolve);

  parser.parseBuffer(pdf_buffer);
});