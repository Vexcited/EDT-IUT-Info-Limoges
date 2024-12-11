import { CustomWorker } from "../core/worker";
import { PageViewport } from "../shared/util";
import { CanvasGraphics } from "./canvas";
import { FontFace } from "./font_loader";

export const getDocument = (buffer: ArrayBuffer): Promise<PDFDocumentProxy> => {
  const transport = new WorkerTransport();
  return transport.fetchDocument(buffer);
};

/**
 * Proxy to a PDFDocument in the worker thread. Also, contains commonly used
 * properties that can be read synchronously.
 */
export class PDFDocumentProxy {
  constructor (
    // @ts-expect-error
    pdfInfo,
    public transport: WorkerTransport
  ) {
    // @ts-expect-error
    this.pdfInfo = pdfInfo;
  }

  /**
   * @return Total number of pages the PDF contains.
   */
  get numPages(): number {
    // @ts-expect-error
    return this.pdfInfo.numPages;
  }
  /**
   * @return A unique ID to identify a PDF. Not guaranteed to be
   * unique.
   */
  get fingerprint(): string {
    // @ts-expect-error
    return this.pdfInfo.fingerprint;
  }
  /**
   * @return `true` if embedded document fonts are in use. Will be
   * set during rendering of the pages.
   */
  get embeddedFontsUsed(): boolean {
    return this.transport.embeddedFontsUsed;
  }
  /**
   * @param number The page number to get. The first page is 1.
   * @return A promise that is resolved with a {PDFPageProxy}
   * object.
   */
  getPage (number: number): Promise<any> {
    return this.transport.getPage(number);
  }

  /**
   * @return A promise that is resolved with an {array} that is a
   * tree outline (if it has one) of the PDF. The tree is in the format of:
   * [
   *  {
   *   title: string,
   *   bold: boolean,
   *   italic: boolean,
   *   color: rgb array,
   *   dest: dest obj,
   *   items: array of more items like this
   *  }
   *  ...
   * ].
   */
  async getOutline (): Promise<any> {
    // @ts-expect-error
    return this.pdfInfo.outline;
  }
  
  getMetadata () {
    // @ts-expect-error
    const info = this.pdfInfo.info;

    return {
      info: info,
      // @ts-expect-error
      metadata: this.pdfInfo.metadata
    };
  }

  /**
   * @return {Promise} A promise that is resolved when the document's data
   * is loaded
   */
  dataLoaded () {
    return this.transport.dataLoaded();
  }
  cleanup () {
    this.transport.startCleanup();
  }
  destroy () {
    this.transport.destroy();
  }
}

export class PDFPageProxy {
  // @ts-expect-error
  constructor (pageInfo, transport) {
    // @ts-expect-error
    this.pageInfo = pageInfo;
    // @ts-expect-error
    this.transport = transport;
    // @ts-expect-error
    this.commonObjs = transport.commonObjs;
    // @ts-expect-error
    this.objs = new PDFObjects();
    // @ts-expect-error
    this.receivingOperatorList  = false;
    // @ts-expect-error
    this.cleanupAfterRender = false;
    // @ts-expect-error
    this.pendingDestroy = false;
  }

  /**
   * @return {number} Page number of the page. First page is 1.
   */
  get pageNumber() {
    // @ts-expect-error
    return this.pageInfo.pageIndex + 1;
  }

  /**
   * @return {number} The number of degrees the page is rotated clockwise.
   */
  get rotate() {
    // @ts-expect-error
    return this.pageInfo.rotate;
  }

  /**
   * @return {object} The reference that points to this page. It has 'num' and
   * 'gen' properties.
   */
  get ref() {
    // @ts-expect-error
    return this.pageInfo.ref;
  }

  /**
   * @return {array} An array of the visible portion of the PDF page in the
   * user space units - [x1, y1, x2, y2].
   */
  get view() {
    // @ts-expect-error
    return this.pageInfo.view;
  }

  /**
   * @param scale The desired scale of the viewport.
   * @param rotate Degrees to rotate the viewport. If omitted this
   * defaults to the page rotation.
   * @return Contains 'width' and 'height' properties along
   * with transforms required for rendering.
   */
  getViewport (scale: number, rotate?: number): PageViewport {
    if (arguments.length < 2)
      rotate = this.rotate;
    // @ts-expect-error
    return new PageViewport(this.view, scale, rotate, 0, 0);
  }

  // @ts-expect-error
  internalRenderTask;

  /**
   * Begins the process of rendering a page to the desired context.
   * @param {object} params A parameter object that supports:
   * {
   *   canvasContext(required): A 2D context of a DOM Canvas object.,
   *   textLayer(optional): An object that has beginLayout, endLayout, and
   *                        appendText functions.,
   *   imageLayer(optional): An object that has beginLayout, endLayout and
   *                         appendImage functions.,
   *   continueCallback(optional): A function that will be called each time
   *                               the rendering is paused.  To continue
   *                               rendering call the function that is the
   *                               first argument to the callback.
   * }.
   * @return {Promise}
   */
  // @ts-expect-error
  async render (params) {
    // @ts-expect-error
    this.pendingDestroy = false;

    // @ts-expect-error
    this.receivingOperatorList = true;
    // @ts-expect-error
    this.operatorList = {
      fnArray: [],
      argsArray: [],
      lastChunk: false
    };

    this.internalRenderTask = new InternalRenderTask(
      params,
      // @ts-expect-error
      this.objs, this.commonObjs,
      // @ts-expect-error
      this.operatorList, this.pageNumber
    );

    // @ts-expect-error
    await this.transport.customWorker.RenderPageRequest({
      pageIndex: this.pageNumber - 1
    });
  }

  /**
   * Destroys resources allocated by the page.
   */
  destroy () {
    // @ts-expect-error
    this.pendingDestroy = true;
    this._tryDestroy();
  }

  /**
   * For internal use only. Attempts to clean up if rendering is in a state
   * where that's possible.
   */
  private _tryDestroy () {
    // @ts-expect-error
    if (!this.pendingDestroy || this.receivingOperatorList) {
      return;
    }

    // @ts-expect-error
    delete this.operatorList;
    // @ts-expect-error
    this.objs.clear();
    // @ts-expect-error
    this.pendingDestroy = false;
  }
  /**
   * For internal use only.
   */
  _startRenderPage () {
    this.internalRenderTask.initalizeGraphics(false);
    this.internalRenderTask.operatorListChanged();
  }
  /**
   * For internal use only.
   */
  // @ts-expect-error
  _renderPageChunk (operatorListChunk) {
    // Add the new chunk to the current operator list.
    for (let i = 0, ii = operatorListChunk.length; i < ii; i++) {
      // @ts-expect-error
      this.operatorList.fnArray.push(operatorListChunk.fnArray[i]);
      // @ts-expect-error
      this.operatorList.argsArray.push(operatorListChunk.argsArray[i]);
    }
    // @ts-expect-error
    this.operatorList.lastChunk = operatorListChunk.lastChunk;

    // Notify all the rendering tasks there are more operators to be consumed.
    this.internalRenderTask.operatorListChanged();

    if (operatorListChunk.lastChunk) {
      // @ts-expect-error
      this.receivingOperatorList = false;
      this._tryDestroy();
    }
  }
}

/**
 * For internal use only.
 */
export class WorkerTransport {
  public commonObjs: PDFObjects;
  public customWorker: CustomWorker;
  public pageCache: PDFPageProxy[];
  public embeddedFontsUsed: boolean;
  public pdfDocument?: PDFDocumentProxy;

  constructor () {
    this.commonObjs = new PDFObjects();

    this.pageCache = [];
    this.embeddedFontsUsed = false;

    this.customWorker = new CustomWorker(this);
  }

  destroy () {
    this.pageCache = [];
  }

  async fetchDocument (buffer: ArrayBuffer): Promise<PDFDocumentProxy> {
    const pdfInfo = await this.customWorker.GetDocRequest({
      source: buffer,
      disableRange: false,
      maxImageSize: -1,
    });

    this.pdfDocument = new PDFDocumentProxy(pdfInfo, this);
    return this.pdfDocument;
  }

  async getData () {
    return this.customWorker.GetData();
  }

  async dataLoaded () {
    return this.customWorker.DataLoaded();
  }

  async getPage (pageNumber: number) {
    const pageIndex = pageNumber - 1;
    
    if (pageIndex in this.pageCache)
      return this.pageCache[pageIndex];
    
    const { pageInfo } = await this.customWorker.GetPageRequest({ pageIndex });
    const page = new PDFPageProxy(pageInfo, this);
    this.pageCache[pageIndex] = page;
    
    return page;
  }

  startCleanup () {
    this.customWorker.Cleanup();

    for (let i = 0, ii = this.pageCache.length; i < ii; i++) {
      const page = this.pageCache[i];
      if (page) page.destroy();
    }

    this.commonObjs.clear();
  }

  // @ts-expect-error
  RenderPageChunk(data) {
    const page = this.pageCache[data.pageIndex];
    page._renderPageChunk(data.operatorList);
  }

  // @ts-expect-error
  StartRenderPage(data) {
    const page = this.pageCache[data.pageIndex];
    page._startRenderPage();
  }

  // @ts-expect-error
  commonobj (data) {
    var id = data[0];
      var type = data[1];
      if (this.commonObjs.hasData(id))
        return;

      switch (type) {
        case 'Font':
          var exportedData = data[2];

          var font;
          if ('error' in exportedData) {
            var error = exportedData.error;
            this.commonObjs.resolve(id, error);
            break;
          } else {
            font = new FontFace(exportedData);
          }

          this.commonObjs.resolve(id, font);
          break;
        case 'FontPath':
          this.commonObjs.resolve(id, data[2]);
          break;
        default:
          throw new Error('Got unknown common object type ' + type);
      }
  }
}

/**
 * A PDF document and page is built of many objects. E.g. there are objects
 * for fonts, images, rendering code and such. These objects might get processed
 * inside of a worker. The `PDFObjects` implements some basic functions to
 * manage these objects.
 */
export class PDFObjects {
  public objs: Record<string, any>;

  constructor () {
    this.objs = {};
  }

  /**
   * Internal function.
   * Ensures there is an object defined for `objId`.
   */
  ensureObj (objId: string) {
    if (this.objs[objId])
      return this.objs[objId];

    const obj = {
      data: null,
    };

    this.objs[objId] = obj;
    return obj;
  }

  /**
   * If called *without* callback, this returns the data of `objId` but the
   * object needs to be resolved. If it isn't, this function throws.
   *
   * If called *with* a callback, the callback is called with the data of the
   * object once the object is resolved. That means, if you call this
   * function and the object is already resolved, the callback gets called
   * right away.
   */
  get (objId: string) {
    const obj = this.objs[objId];
    return obj.data;
  }

  /**
   * Resolves the object `objId` with optional `data`.
   */
  // @ts-expect-error
  resolve (objId: string, data) {
    const obj = this.ensureObj(objId);
    obj.data = data;
  }

  isResolved (objId: string) {
    if (!this.objs[objId]) {
      return false;
    }
  }

  hasData (objId: string) {
    return this.isResolved(objId);
  }

  /**
   * Returns the data of `objId` if object exists, null otherwise.
   */
  getData (objId: string) {
    const objs = this.objs;
    if (!objs[objId]) {
      return null;
    } else {
      return objs[objId].data;
    }
  }

  clear () {
    this.objs = {};
  }
}

export class InternalRenderTask {
  // @ts-expect-error
  constructor (params, objs, commonObjs, operatorList, pageNumber) {
    // @ts-expect-error
    this.params = params;
    // @ts-expect-error
    this.objs = objs;
    // @ts-expect-error
    this.commonObjs = commonObjs;
    // @ts-expect-error
    this.operatorListIdx = null;
    // @ts-expect-error
    this.operatorList = operatorList;
    // @ts-expect-error
    this.pageNumber = pageNumber;
    // @ts-expect-error
    this.running = false;
    // @ts-expect-error
    this.graphicsReadyCallback = null;
    // @ts-expect-error
    this.graphicsReady = false;
    // @ts-expect-error
    this.cancelled = false;
  }

  initalizeGraphics (transparency: boolean) {
    // @ts-expect-error
    if (this.cancelled) {
      return;
    }

    // @ts-expect-error
    var params = this.params;
    // @ts-expect-error
    this.gfx = new CanvasGraphics(params.canvasContext, this.commonObjs, this.objs, params.textLayer, params.imageLayer);
    
    // @ts-expect-error
    this.gfx.beginDrawing(params.viewport, transparency);
    // @ts-expect-error
    this.operatorListIdx = 0;
    // @ts-expect-error
    this.graphicsReady = true;
    // @ts-expect-error
    if (this.graphicsReadyCallback) {
      // @ts-expect-error
      this.graphicsReadyCallback();
    }
  }
  
  cancel () {
    // @ts-expect-error
    this.running = false;
    // @ts-expect-error
    this.cancelled = true;
  }
  
  operatorListChanged () {
    // @ts-expect-error
    if (!this.graphicsReady) {
      // @ts-expect-error
      if (!this.graphicsReadyCallback) {
        // @ts-expect-error
        this.graphicsReadyCallback = () => this._continue();
      }
      return;
    }
    
    // @ts-expect-error
    if (this.running) {
      return;
    }
    
    this._continue();
  }
  
  _continue () {
    // @ts-expect-error
    this.running = true;
    // @ts-expect-error
    if (this.cancelled) {
      return;
    }
    // @ts-expect-error
    if (this.params.continueCallback) {
      // @ts-expect-error
      this.params.continueCallback(() => this._next());
    } else {
      this._next();
    }
  }
  
  _next () {
    // @ts-expect-error
    if (this.cancelled) {
      return;
    }
    // @ts-expect-error
    this.operatorListIdx = this.gfx.executeOperatorList(this.operatorList, this.operatorListIdx);
    // @ts-expect-error
    if (this.operatorListIdx === this.operatorList.argsArray.length) {
      // @ts-expect-error
      this.running = false;
      // @ts-expect-error
      if (this.operatorList.lastChunk) {
        // @ts-expect-error
        this.gfx.endDrawing();
        return;
      }
    }
  }
}
