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

//MQZ. Oct.11.2012. Add Worker's postMessage API
var __postMessage = function WorkerTransport_postMessage(obj) {
//  log("Inside globalScope.postMessage:" + JSON.stringify(obj));
};

var WorkerMessageHandler = PDFJS.WorkerMessageHandler = {
  setup: function wphSetup(handler) {
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
      PDFJS.disableFontFace = data.disableFontFace;

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

    handler.on('GetAnnotationsRequest', function wphSetupGetAnnotations(data) {
      pdfManager.getPage(data.pageIndex).then(function(page) {
        pdfManager.ensure(page, 'getAnnotationsData', []).then(
          function(annotationsData) {
            handler.send('GetAnnotations', {
              pageIndex: data.pageIndex,
              annotations: annotationsData
            });
          }
        );
      });
    });

    handler.on('RenderPageRequest', async (data) => {
      const page = await pdfManager.getPage(data.pageIndex);
      console.log('RenderPageRequest', { pageIndex: data.pageIndex });

      // pre-compile the PDF page and fetch the fonts/images.
      await page.getOperatorList(handler);
    }, this);

    handler.on('GetTextContent', function wphExtractText(data, promise) {
      pdfManager.getPage(data.pageIndex).then(function(page) {
        var pageNum = data.pageIndex + 1;
        var start = Date.now();
        page.extractTextContent().then(function(textContent) {
          promise.resolve(textContent);
        }, function (e) {
          // Skip errored pages
          promise.reject(e);
        });
      });
    });

    handler.on('Cleanup', function wphCleanup(data, promise) {
      console.log('Worker cleanup');
      pdfManager.cleanup();
      promise.resolve(true);
    });

    handler.on('Terminate', function wphTerminate(data, promise) {
      console.log('Worker terminated');
      pdfManager.terminate();
      promise.resolve();
    });
  }
};

var consoleTimer = {};

var workerConsole = {
  log: function log() {
    var args = Array.prototype.slice.call(arguments);
    __postMessage({
      action: 'console_log',
      data: args
    });
  },

  error: function error() {
    var args = Array.prototype.slice.call(arguments);
    __postMessage({
      action: 'console_error',
      data: args
    });
    throw 'pdf.js execution error';
  },

  time: function time(name) {
    consoleTimer[name] = Date.now();
  },

  timeEnd: function timeEnd(name) {
    var time = consoleTimer[name];
    if (!time) {
      error('Unkown timer name ' + name);
    }
    this.log('Timer:', name, Date.now() - time);
  }
};

// Worker thread?
if (typeof window === 'undefined') {
  // globalScope.console = workerConsole;

  // Add a logger so we can pass warnings on to the main thread, errors will
  // throw an exception which will be forwarded on automatically.
  PDFJS.LogManager.addLogger({
    warn: function(msg) {
      __postMessage({
        action: '_warn',
        data: msg
      });
    }
  });

  var handler = new MessageHandler('worker_processor', this);
  WorkerMessageHandler.setup(handler);
}
