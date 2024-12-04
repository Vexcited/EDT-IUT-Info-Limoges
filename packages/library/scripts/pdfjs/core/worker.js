/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals error, globalScope, InvalidPDFException, log,
           MissingPDFException, PasswordException, PDFJS, Promise,
           UnknownErrorException, NetworkManager, LocalPdfManager,
           , XRefParseException,
           isInt, PasswordResponses, MessageHandler, Ref */

'use strict';

var WorkerMessageHandler = PDFJS.WorkerMessageHandler = {
  setup (handler) {
    var pdfManager;

    async function loadDocument (recoveryMode) {
      await pdfManager.ensureModel('checkHeader', [])
      await pdfManager.ensureModel('parseStartXRef', [])
      await pdfManager.ensureModel('parse', [recoveryMode]);

      const numPagesPromise = pdfManager.ensureModel('numPages');
      const fingerprintPromise = pdfManager.ensureModel('fingerprint');
      const outlinePromise = pdfManager.ensureCatalog('documentOutline');
      const infoPromise = pdfManager.ensureModel('documentInfo');
      const metadataPromise = pdfManager.ensureCatalog('metadata');
      const encryptedPromise = pdfManager.ensureXRef('encrypt');
      const javaScriptPromise = pdfManager.ensureCatalog('javaScript');

      const results = await Promise.all([
        numPagesPromise,
        fingerprintPromise,
        outlinePromise,
        infoPromise,
        metadataPromise,
        encryptedPromise,
        javaScriptPromise
      ])
      
      return {
        numPages: results[0],
        fingerprint: results[1],
        outline: results[2],
        info: results[3],
        metadata: results[4],
        encrypted: !!results[5],
        javaScript: results[6]
      };
    }

    function getPdfManager (data) {
      const source = data.source;
      pdfManager = new LocalPdfManager(source.data, source.password);
    }

    handler.on('GetDocRequest', async (data) => {
      PDFJS.maxImageSize = data.maxImageSize === undefined ? -1 : data.maxImageSize;
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

    handler.on('GetDestinations',
      function wphSetupGetDestinations(data, promise) {
        pdfManager.ensureCatalog('destinations').then(function(destinations) {
          promise.resolve(destinations);
        });
      }
    );

    handler.on('GetData', function wphSetupGetData(data, promise) {
      pdfManager.requestLoadedStream();
      pdfManager.onLoadedStream().then(function(stream) {
        promise.resolve(stream.bytes);
      });
    });

    handler.on('DataLoaded', function wphSetupDataLoaded(data, promise) {
      pdfManager.onLoadedStream().then(function(stream) {
        promise.resolve({ length: stream.bytes.byteLength });
      });
    });

    handler.on('UpdatePassword', function wphSetupUpdatePassword(data) {
      pdfManager.updatePassword(data);
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
