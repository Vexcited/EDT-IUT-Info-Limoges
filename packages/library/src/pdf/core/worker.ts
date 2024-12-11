import { WorkerTransport } from "../display/api";
import { LocalPdfManager } from "./pdf_manager";

export class CustomWorker {
  public pdfManager?: LocalPdfManager;
  constructor (public transport: WorkerTransport) {}

  async loadDocument (recoveryMode?: boolean) {
    if (!this.pdfManager) {
      throw new Error('pdfManager not initialized');
    }

    await this.pdfManager.ensureModel('checkHeader', [])
    await this.pdfManager.ensureModel('parseStartXRef', [])
    await this.pdfManager.ensureModel('parse', [recoveryMode]);

    // @ts-expect-error
    const numPagesPromise = this.pdfManager.ensureModel('numPages');
    // @ts-expect-error
    const fingerprintPromise = this.pdfManager.ensureModel('fingerprint');
    // @ts-expect-error
    const outlinePromise = this.pdfManager.ensureCatalog('documentOutline');
    // @ts-expect-error
    const infoPromise = this.pdfManager.ensureModel('documentInfo');
    // @ts-expect-error
    const metadataPromise = this.pdfManager.ensureCatalog('metadata');

    const results = await Promise.all([
      numPagesPromise,
      fingerprintPromise,
      outlinePromise,
      infoPromise,
      metadataPromise,
    ])
    
    return {
      numPages: results[0],
      fingerprint: results[1],
      outline: results[2],
      info: results[3],
      metadata: results[4],
    };
  }

  private getPdfManager (data: {
    source: ArrayBuffer
    disableRange: boolean
    maxImageSize: number
  }): void {
    this.pdfManager = new LocalPdfManager(data.source);
  }

  // replies with GetDoc
  async GetDocRequest (data: {
    source: ArrayBuffer
    disableRange: boolean
    maxImageSize: number
  }) {
    // Define `this.pdfManager`.
    this.getPdfManager(data);
    return this.loadDocument(false)
  }

  // @ts-expect-error
  async GetPageRequest (data) {
    if (!this.pdfManager) {
      throw new Error('pdfManager not initialized');
    }

    const page = await this.pdfManager.getPage(data.pageIndex);

    const results = await Promise.all([
      this.pdfManager.ensure(page, 'rotate'),
      this.pdfManager.ensure(page, 'ref'),
      this.pdfManager.ensure(page, 'view')
    ]);
      
    const pageInfo = {
      pageIndex: data.pageIndex,
      rotate: results[0],
      ref: results[1],
      view: results[2]
    };

    return { pageInfo };
  }

  Cleanup () {
    this.pdfManager!.cleanup();
  }

  async GetData () {
    const stream = await this.pdfManager!.onLoadedStream();
    return stream.bytes;
  }

  async DataLoaded () {
    const stream = await this.pdfManager!.onLoadedStream();
    return { length: stream.bytes.byteLength };
  }

  // @ts-expect-error
  async RenderPageRequest (data) {
    const page = await this.pdfManager!.getPage(data.pageIndex);
    // pre-compile the PDF page and fetch the fonts/images.
    await page.getOperatorList(this.transport);
  }
}
