'use strict';

var pdfManager;

class CUSTOMWorker {
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
}

var WorkerMessageHandler = PDFJS.WorkerMessageHandler = {
  setup (handler) {

    async function loadDocument (recoveryMode) {
      await pdfManager.ensureModel('checkHeader', [])
      await pdfManager.ensureModel('parseStartXRef', [])
      await pdfManager.ensureModel('parse', [recoveryMode]);

      const numPagesPromise = pdfManager.ensureModel('numPages');
      const fingerprintPromise = pdfManager.ensureModel('fingerprint');
      const outlinePromise = pdfManager.ensureCatalog('documentOutline');
      const infoPromise = pdfManager.ensureModel('documentInfo');
      const metadataPromise = pdfManager.ensureCatalog('metadata');

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

    function getPdfManager (data) {
      const source = data.source;
      pdfManager = new LocalPdfManager(source.data);
    }

    handler.on('GetDocRequest', async (data) => {
      getPdfManager(data); // make sure it's defined

      var doc = await loadDocument(false)
      handler.send('GetDoc', { pdfInfo: doc });
    });

    handler.on('GetPageRequest', async (data) => {
      const page = await pdfManager.getPage(data.pageIndex);

      const results = await Promise.all([
        pdfManager.ensure(page, 'rotate'),
        pdfManager.ensure(page, 'ref'),
        pdfManager.ensure(page, 'view')
      ]);
        
      const pageInfo = {
        pageIndex: data.pageIndex,
        rotate: results[0],
        ref: results[1],
        view: results[2]
      };

      handler.send('GetPage', { pageInfo });
    });

    handler.on('GetPageIndex', function wphSetupGetPageIndex(data, promise) {
      var ref = new Ref(data.ref.num, data.ref.gen);
      pdfManager.pdfModel.catalog.getPageIndex(ref).then(function (pageIndex) {
        promise.resolve(pageIndex);
      }, promise.reject.bind(promise));
    });

    handler.on('GetData', function wphSetupGetData(data, promise) {
      pdfManager.onLoadedStream().then(function(stream) {
        promise.resolve(stream.bytes);
      });
    });

    handler.on('DataLoaded', function wphSetupDataLoaded(data, promise) {
      pdfManager.onLoadedStream().then(function(stream) {
        promise.resolve({ length: stream.bytes.byteLength });
      });
    });

    handler.on('RenderPageRequest', async (data) => {
      const page = await pdfManager.getPage(data.pageIndex);

      // pre-compile the PDF page and fetch the fonts/images.
      await page.getOperatorList(handler);
    }, this);

    handler.on('Cleanup', function wphCleanup(data, promise) {
      pdfManager.cleanup();
      promise.resolve(true);
    });

    handler.on('Terminate', function wphTerminate(data, promise) {
      pdfManager.terminate();
      promise.resolve();
    });
  }
};
