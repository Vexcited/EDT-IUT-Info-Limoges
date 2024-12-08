import type { Output } from "../converter";
import PDFParser from "../converter";

export const getRawPDF = async (pdf_buffer: ArrayBuffer): Promise<Output> => {
  const parser = new PDFParser();

  const data = await new Promise<Output>((resolve, reject) => {
    parser.on("pdfParser_dataError", reject);
    parser.on("pdfParser_dataReady", resolve);

    parser.parseBuffer(pdf_buffer)
  })
  
  parser.destroy();
  return data;
};
