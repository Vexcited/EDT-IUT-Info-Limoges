'use strict';

var pdfManager;

class CUSTOMWorker {
  constructor (transport) {
    this.transport = transport;
  }

  async loadDocument (recoveryMode) {
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

  getPdfManager (data) {
    const source = data.source;
    this.pdfManager = new LocalPdfManager(source.data);
    // TODO: remove this
    pdfManager = this.pdfManager;
  }

  // replies with GetDoc
  async GetDocRequest (data) {
    this.getPdfManager(data); // make sure it's defined

    const pdfInfo = await this.loadDocument(false)
    return { pdfInfo };
  }

  // replies with GetPage
  async GetPageRequest (data) {
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

  async GetPageIndex (data) {
    const ref = new Ref(data.ref.num, data.ref.gen);
    return this.pdfManager.pdfModel.catalog.getPageIndex(ref);
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
