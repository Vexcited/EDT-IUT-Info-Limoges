import { LocalPdfManager } from "./pdf_manager";

export class CustomWorker {
  public pdfManager?: LocalPdfManager;
  public transport?: any;

  constructor (transport) {
    this.transport = transport;
  }

  async loadDocument (recoveryMode?: boolean) {
    if (!this.pdfManager) {
      throw new Error('pdfManager not initialized');
    }

    await this.pdfManager.ensureModel('checkHeader', [])
    await this.pdfManager.ensureModel('parseStartXRef', [])
    await this.pdfManager.ensureModel('parse', [recoveryMode]);

    const numPagesPromise = this.pdfManager.ensureModel('numPages');
    const fingerprintPromise = this.pdfManager.ensureModel('fingerprint');
    const outlinePromise = this.pdfManager.ensureCatalog('documentOutline');
    const infoPromise = this.pdfManager.ensureModel('documentInfo');
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
    this.pdfManager.cleanup();
  }

  async GetData () {
    const stream = await this.pdfManager.onLoadedStream();
    return stream.bytes;
  }

  async DataLoaded () {
    const stream = await this.pdfManager.onLoadedStream();
    return { length: stream.bytes.byteLength };
  }

  async RenderPageRequest (data) {
    const page = await this.pdfManager.getPage(data.pageIndex);
    // pre-compile the PDF page and fetch the fonts/images.
    await page.getOperatorList(this.transport);
  }
}
