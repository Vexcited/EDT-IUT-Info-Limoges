import type { Page } from "./types";
import PDFJS from "./pdf";

class PDFParser {
  public pdf = new PDFJS();
	public async parseBuffer (buffer: ArrayBuffer): Promise<Page[]> {
		await this.pdf.parse(buffer);
    return this.pdf.pages;
	}
}

export default PDFParser;
export type { Page, Fill, Text } from "./types";
export { kColors, kFontFaces, kFontStyles } from "./pdfconst";
