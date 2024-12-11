import PDFCanvas, { type Canvas } from "./pdfcanvas";
import { getDocument, PDFDocumentProxy, PDFPageProxy } from "../pdf/display/api";
import type { Page } from "./types";
import { PageViewport } from "../pdf/shared/util";

const createScratchCanvas = (width: number, height: number): PDFCanvas => {
  return new PDFCanvas({}, width, height);
}

class PDFPageParser {
  public static RenderingStates = {
    INITIAL: 0,
    RUNNING: 1,
    PAUSED: 2,
    FINISHED: 3
  };
  
  public viewport: PageViewport;
  public renderingState = PDFPageParser.RenderingStates.INITIAL;

  public ctxCanvas: Canvas;
  public Boxsets: any[];

  constructor (
    public pdfPage: PDFPageProxy, 
    public id: number, 
    public scale: number
  ) {
    this.scale = scale || 1;
    this.viewport = this.pdfPage.getViewport(this.scale);

    this.Boxsets = [];
    this.ctxCanvas = <Canvas>{};
  }
  
  get width() { return this.viewport!.width; }
  get height() { return this.viewport!.height; }
  get HLines() { return this.ctxCanvas.HLines; }
  get VLines() { return this.ctxCanvas.VLines; }
  get Fills() { return this.ctxCanvas.Fills; }
  get Texts() { return this.ctxCanvas.Texts; }

  destroy (): void {
    this.pdfPage.destroy();
    this.ctxCanvas = <Canvas>{};
  }

  getPagePoint (x: number, y: number): number[] {
    return this.viewport!.convertToPdfPoint(x, y);
  }

  async parsePage (): Promise<void> {
    if (this.renderingState !== PDFPageParser.RenderingStates.INITIAL) {
      throw new Error('Must be in new state before drawing');
    }

    this.renderingState = PDFPageParser.RenderingStates.RUNNING;

    const canvas = createScratchCanvas(1, 1);
    const ctx = canvas.getContext('2d')!;

    const renderContext = {
      canvasContext: ctx,
      viewport: this.viewport
    };

    await this.pdfPage.render(renderContext);
    this.renderingState = PDFPageParser.RenderingStates.FINISHED;
    this.ctxCanvas = ctx.canvas;
  }
}

export default class PDF {
  public document?: PDFDocumentProxy;
  public pages: Page[] = [];

  public async parse (arrayBuffer: ArrayBuffer): Promise<void> {
    this.document = await getDocument(arrayBuffer);
    await this.loadPages();
  };

	async loadPages (): Promise<void> {
		const promises = [];

		for (let i = 1; i <= this.document!.numPages; i++) {
			promises.push(this.document!.getPage(i));
    }

		const pages = await Promise.all(promises);
    await this.parsePages(pages, 0, 1.5);
	}

  async parsePages (pages: PDFPageProxy[], id: number, scale: number): Promise<void> {
    while (id < this.document!.numPages) {
      const parser = new PDFPageParser(pages[id], id, scale);
      await parser.parsePage();
  
      const page = {
        Width:  parser.width,
        Height: parser.height,
        HLines: parser.HLines,
        VLines: parser.VLines,
        Fills:  parser.Fills,
        Texts:  parser.Texts,
      } satisfies Page;
  
      this.pages.push(page);
      id++;
    }
  }

  destroy (): void {
    this.document?.destroy();
    this.pages = [];
  }
}
