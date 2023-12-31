import { EventEmitter } from "node:events";

import PDFCanvas from "./pdfcanvas";

function createScratchCanvas(width: number, height: number) { return new PDFCanvas({}, width, height); }

class PDFPageParser {
    //static
    static RenderingStates = {
        INITIAL: 0,
        RUNNING: 1,
        PAUSED: 2,
        FINISHED: 3
    };
  
    //public
    id = -1;
    pdfPage = null;
    scale = 0;
    viewport = null;
    renderingState = -1;

    ctxCanvas = null;

    // @ts-expect-error
    constructor(pdfPage, id, scale) {
        // public, this instance copies
        this.id = id;
        this.pdfPage = pdfPage;

        this.scale = scale || 1.0;

        //leave out the 2nd parameter in order to use page's default rotation (for both portrait and landscape form)
        // @ts-expect-error
        this.viewport = this.pdfPage.getViewport(this.scale);

        this.renderingState = PDFPageParser.RenderingStates.INITIAL;

        //form elements: radio buttons and check boxes
        // @ts-expect-error
        this.Boxsets = [];
        // @ts-expect-error
        this.ctxCanvas = {};
    }
    
    // @ts-expect-error
    get width() { return this.viewport.width; }
    // @ts-expect-error
    get height() { return this.viewport.height; }
    // @ts-expect-error
    get HLines() { return this.ctxCanvas.HLines; }
    // @ts-expect-error
    get VLines() { return this.ctxCanvas.VLines; }
    // @ts-expect-error
    get Fills() { return this.ctxCanvas.Fills; }
    // @ts-expect-error
    get Texts() { return this.ctxCanvas.Texts; }

    destroy() {
      // @ts-expect-error
      this.pdfPage.destroy();
	    this.pdfPage = null;

      this.ctxCanvas = null;
    }

    // @ts-expect-error
    getPagePoint(x, y) {
      // @ts-expect-error
        return this.viewport.convertToPdfPoint(x, y);
    }

    // @ts-expect-error
    parsePage(callback, errorCallBack) {
        if (this.renderingState !== PDFPageParser.RenderingStates.INITIAL) {
            errorCallBack('Must be in new state before drawing');
            return;
        }

        this.renderingState = PDFPageParser.RenderingStates.RUNNING;

        const canvas = createScratchCanvas(1, 1);
        const ctx = canvas.getContext('2d');

        // @ts-expect-error
        function pageViewDrawCallback(error) {
          // @ts-expect-error
            this.renderingState = PDFPageParser.RenderingStates.FINISHED;

            if (error) {
                console.error(error);
                // @ts-expect-error
                errorCallBack(`Error: Page ${this.id + 1}: ${error.message}`);
            }
            else {
              // @ts-expect-error
                this.ctxCanvas = ctx.canvas;
                // @ts-expect-error
                this.stats = this.pdfPage.stats;

                callback();
            }
        }

        const renderContext = {
            canvasContext:ctx,
            viewport:this.viewport
        };

        // @ts-expect-error
        this.pdfPage.render(renderContext).then(
            () => {
              pageViewDrawCallback.call(this, null);
            },
            // @ts-expect-error
            err => pageViewDrawCallback.call(this, err)
        );
    }
}

// empty object on import,
// will be populated by the PDFJS library code
// after the first 
const PDFJS = {};
let PDFJSLoaded = false;

export default class PDFJSClass extends EventEmitter {
  pdfDocument = null;
  pages = null;

  constructor () {
    super();

    // public, this instance copies
    this.pdfDocument = null;
    // @ts-expect-error
    this.pages = [];
  }

    // @ts-expect-error
    raiseErrorEvent(errMsg) {
        console.error(errMsg);
        process.nextTick( () => this.emit("pdfjs_parseDataError", errMsg));
        // this.emit("error", errMsg);
        return errMsg;
    }

    // @ts-expect-error
    raiseReadyEvent(data) {
        process.nextTick( () => this.emit("pdfjs_parseDataReady", data) );
        return data;
    }


  // @ts-expect-error
  public parsePDFData(arrayBuffer, password) {
    this.pdfDocument = null;

    // instantiate the PDFJS object only when needed.
    if (!PDFJSLoaded) {
      const { code } = require("./pdfjs_bundle");
      eval(code);
      PDFJSLoaded = true;
    }

    const parameters = {password: password, data: arrayBuffer};
    // @ts-expect-error
    PDFJS.getDocument(parameters).then(
      // @ts-expect-error
        pdfDocument => this.load(pdfDocument),
        // @ts-expect-error
        error => this.raiseErrorEvent(error)
    );
  };

  // @ts-expect-error
  private load (pdfDocument) {
      this.pdfDocument = pdfDocument;

    return this.loadMetaData().then(
      () => this.loadPages(),
      // @ts-expect-error
    error => this.raiseErrorEvent("loadMetaData error: " + error)
    );
  }

	private loadMetaData () {
    // @ts-expect-error
		return this.pdfDocument.getMetadata().then(
      // @ts-expect-error
			data => {
        // @ts-expect-error
				this.documentInfo = data.info;
        // @ts-expect-error
				this.metadata = data.metadata?.metadata ?? {};
				this.parseMetaData();
			},
      // @ts-expect-error
			error => this.raiseErrorEvent("pdfDocument.getMetadata error: " + error)
		);
	}

  private parseMetaData () {
    // @ts-expect-error
    const meta = {Transcoder: "pdf2json@3.0.4 [https://github.com/modesty/pdf2json]", Meta: {...this.documentInfo, Metadata: this.metadata}};
    this.raiseReadyEvent(meta);
    this.emit("readable", meta);
  }

	loadPages() {
    // @ts-expect-error
		const pagesCount = this.pdfDocument.numPages;
		const pagePromises = [];
		for (let i = 1; i <= pagesCount; i++)
    // @ts-expect-error
			pagePromises.push(this.pdfDocument.getPage(i));

		const pagesPromise = Promise.all(pagePromises);
    
		return pagesPromise.then(
			promisedPages => this.parsePage(promisedPages, 0, 1.5),
			error => this.raiseErrorEvent("pagesPromise error: " + error)
		);
	}

  // @ts-expect-error
    parsePage(promisedPages, id, scale) {
        const pdfPage = promisedPages[id];
        const pageParser = new PDFPageParser(pdfPage, id, scale);

        function continueOnNextPage() {
          // @ts-expect-error
            if (id === (this.pdfDocument.numPages - 1) ) {
              // @ts-expect-error
	            this.raiseReadyEvent({Pages:this.pages});                
	            //v1.1.2: signal end of parsed data with null
              // @ts-expect-error
	            process.nextTick(() => this.raiseReadyEvent(null));
              // @ts-expect-error
                this.emit("data", null);
            }
            else {
              // @ts-expect-error
                process.nextTick(() => this.parsePage(promisedPages, ++id, scale));
            }
        }

        pageParser.parsePage(
          // @ts-expect-error
	        data => {
	            const page = {
                    Width:  pageParser.width,
                    Height: pageParser.height,
	                HLines: pageParser.HLines,
	                VLines: pageParser.VLines,
	                Fills:  pageParser.Fills,
	                Texts: pageParser.Texts,
	            };

              // @ts-expect-error
	            this.pages.push(page);
              this.emit("data", page);

              continueOnNextPage.call(this);
	        },
          // @ts-expect-error
	        errMsg => this.raiseErrorEvent(errMsg)
        );
    }

    destroy() {
        this.removeAllListeners();

        if (this.pdfDocument)
        // @ts-expect-error
            this.pdfDocument.destroy();
        this.pdfDocument = null;

        this.pages = null;
    }

}