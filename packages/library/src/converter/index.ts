import type { Output } from "./types";
import { EventEmitter } from "node:events";

import PDFJS from "./pdf";
import { kColors, kFontFaces, kFontStyles } from "./pdfconst";

class PDFParser extends EventEmitter {
  public static get colorDict () { return kColors; }
  public static get fontFaceDict () { return kFontFaces; }
  public static get fontStyleDict () { return kFontStyles; }

  #password: string;
  
  #data: Partial<Output> | null = null;
  #PDFJS: PDFJS;

  constructor (password = "") {
    super();

    this.#password = password;
      
    this.#data = null;
    this.#PDFJS = new PDFJS();
  } 
    
	#onPDFJSParseDataReady(data: Partial<Output> | null): void {
		if (data === null) { // data===null means end of parsed data
			this.emit("pdfParser_dataReady", this.#data);
		}
		else {
			this.#data = {...this.#data, ...data};            
		}
	}

	#onPDFJSParserDataError(err: any) {
		this.#data = null;
		this.emit("pdfParser_dataError", {"parserError": err});
	}

	async #startParsingPDF (buffer: ArrayBuffer): Promise<void> {
		this.#data = {};

		this.#PDFJS.on("pdfjs_parseDataReady", data => this.#onPDFJSParseDataReady(data));
		this.#PDFJS.on("pdfjs_parseDataError", err => this.#onPDFJSParserDataError(err));

    // The following Readable Stream-like events are replacement for the top two custom events
    this.#PDFJS.on("readable", meta => this.emit("readable", meta));
    this.#PDFJS.on("data", data => this.emit("data", data));
    this.#PDFJS.on("error", err => this.#onPDFJSParserDataError(err));    

		await this.#PDFJS.parsePDFData(buffer);
	}

	public async parseBuffer (pdfBuffer: ArrayBuffer): Promise<void> {
		await this.#startParsingPDF(pdfBuffer);
	}

	public destroy() {
    super.removeAllListeners();

		this.#data = null;
    this.#PDFJS.destroy();
	}
}

export default PDFParser;
export type { Output, Page, Fill, Text } from "./types";
