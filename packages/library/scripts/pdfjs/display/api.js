/**
 * This is the main entry point for loading a PDF and interacting with it.
 * NOTE: If a URL is used to fetch the PDF data a standard XMLHttpRequest(XHR)
 * is used, which means it must follow the same origin rules that any XHR does
 * e.g. No cross domain requests without CORS.
 *
 * @param {string|TypedAray|object} source Can be an url to where a PDF is
 * located, a typed array (Uint8Array) already populated with data or
 * and parameter object with the following possible fields:
 *  - url   - The URL of the PDF.
 *  - data  - A typed array with PDF data.
 *  - httpHeaders - Basic authentication headers.
 *  - password - For decrypting password-protected PDFs.
 *  - initialData - A typed array with the first portion or all of the pdf data.
 *                  Used by the extension since some data is already loaded
 *                  before the switch to range requests. 
 *
 * @return {Promise} A promise that is resolved with {PDFDocumentProxy} object.
 */
PDFJS.getDocument = (buffer) => {
  return new OPromise((resolve, reject) => {
    const wrapper = { resolve, reject };
    const transport = new WorkerTransport(wrapper);
    transport.fetchDocument({ data: buffer });
  })
};

/**
 * Proxy to a PDFDocument in the worker thread. Also, contains commonly used
 * properties that can be read synchronously.
 */
class PDFDocumentProxy {
  constructor (pdfInfo, transport) {
    this.pdfInfo = pdfInfo;
    this.transport = transport;
  }

  /**
   * @return {number} Total number of pages the PDF contains.
   */
  get numPages() {
    return this.pdfInfo.numPages;
  }
  /**
   * @return {string} A unique ID to identify a PDF. Not guaranteed to be
   * unique.
   */
  get fingerprint() {
    return this.pdfInfo.fingerprint;
  }
  /**
   * @return {boolean} true if embedded document fonts are in use. Will be
   * set during rendering of the pages.
   */
  get embeddedFontsUsed() {
    return this.transport.embeddedFontsUsed;
  }
  /**
   * @param {number} The page number to get. The first page is 1.
   * @return {Promise} A promise that is resolved with a {PDFPageProxy}
   * object.
   */
  getPage (number) {
    return this.transport.getPage(number);
  }
  /**
   * @param {object} Must have 'num' and 'gen' properties.
   * @return {Promise} A promise that is resolved with the page index that is
   * associated with the reference.
   */
  getPageIndex (ref) {
    return this.transport.getPageIndex(ref);
  }
  /**
   * @return {Promise} A promise that is resolved with a lookup table for
   * mapping named destinations to reference numbers.
   */
  getDestinations () {
    return this.transport.getDestinations();
  }
  /**
   * @return {Promise} A promise that is resolved with an array of all the
   * JavaScript strings in the name tree.
   */
  async getJavaScript () {
    var js = this.pdfInfo.javaScript;
    return js;
  }
  /**
   * @return {Promise} A promise that is resolved with an {array} that is a
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
  getOutline () {
    var promise = new PDFJS.Promise();
    var outline = this.pdfInfo.outline;
    promise.resolve(outline);
    return promise;
  }
  
  getMetadata () {
    const info = this.pdfInfo.info;

    return {
      info: info,
      metadata: this.pdfInfo.metadata
    };
  }

  /**
   * @return {Promise} A promise that is resolved with a TypedArray that has
   * the raw data from the PDF.
   */
  getData () {
    var promise = new PDFJS.Promise();
    this.transport.getData(promise);
    return promise;
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

class PDFPageProxy {
  constructor (pageInfo, transport) {
    this.pageInfo = pageInfo;
    this.transport = transport;
    this.commonObjs = transport.commonObjs;
    this.objs = new PDFObjects();
    this.receivingOperatorList  = false;
    this.cleanupAfterRender = false;
    this.pendingDestroy = false;
    this.renderTasks = [];
  }

  /**
   * @return {number} Page number of the page. First page is 1.
   */
  get pageNumber() {
    return this.pageInfo.pageIndex + 1;
  }

  /**
   * @return {number} The number of degrees the page is rotated clockwise.
   */
  get rotate() {
    return this.pageInfo.rotate;
  }

  /**
   * @return {object} The reference that points to this page. It has 'num' and
   * 'gen' properties.
   */
  get ref() {
    return this.pageInfo.ref;
  }

  /**
   * @return {array} An array of the visible portion of the PDF page in the
   * user space units - [x1, y1, x2, y2].
   */
  get view() {
    return this.pageInfo.view;
  }

  /**
   * @param {number} scale The desired scale of the viewport.
   * @param {number} rotate Degrees to rotate the viewport. If omitted this
   * defaults to the page rotation.
   * @return {PageViewport} Contains 'width' and 'height' properties along
   * with transforms required for rendering.
   */
  getViewport (scale, rotate) {
    if (arguments.length < 2)
      rotate = this.rotate;
    return new PDFJS.PageViewport(this.view, scale, rotate, 0, 0);
  }

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
   * @return {RenderTask} An extended promise that is resolved when the page
   * finishes rendering (see RenderTask).
   */
  render (params) {
    // If there was a pending destroy cancel it so no cleanup happens during
    // this call to render.
    this.pendingDestroy = false;

    // If there is no displayReadyPromise yet, then the operatorList was never
    // requested before. Make the request and create the promise.
    if (!this.displayReadyPromise) {
      this.receivingOperatorList = true;
      this.displayReadyPromise = new Promise();
      this.operatorList = {
        fnArray: [],
        argsArray: [],
        lastChunk: false
      };

      this.transport.messageHandler.send('RenderPageRequest', {
        pageIndex: this.pageNumber - 1
      });
    }

    var internalRenderTask = new InternalRenderTask(complete, params,
                                      this.objs, this.commonObjs,
                                      this.operatorList, this.pageNumber);
    this.renderTasks.push(internalRenderTask);
    var renderTask = new RenderTask(internalRenderTask);

    var self = this;
    this.displayReadyPromise.then(
      function pageDisplayReadyPromise(transparency) {
        if (self.pendingDestroy) {
          complete();
          return;
        }
        try {//MQZ. catch canvas drawing exceptions
          internalRenderTask.initalizeGraphics(transparency);
          internalRenderTask.operatorListChanged();
        }
        catch(err) {
          complete(err); 
        }
      },
      function pageDisplayReadPromiseError(reason) {
        complete(reason);
      }
    );

    function complete(error) {
      var i = self.renderTasks.indexOf(internalRenderTask);
      if (i >= 0) {
        self.renderTasks.splice(i, 1);
      }

      if (self.cleanupAfterRender) {
        self.pendingDestroy = true;
      }
      self._tryDestroy();

      if (error) {
        renderTask.reject(error);
      } else {
        renderTask.resolve();
      }
    }

    return renderTask;
  }

  /**
   * Stub for future feature.
   */
  getOperationList () {
    var promise = new PDFJS.Promise();
    var operationList = { // not implemented
      dependencyFontsID: null,
      operatorList: null
    };
    promise.resolve(operationList);
    return promise;
  }
  /**
   * Destroys resources allocated by the page.
   */
  destroy () {
    this.pendingDestroy = true;
    this._tryDestroy();
  }
  /**
   * For internal use only. Attempts to clean up if rendering is in a state
   * where that's possible.
   */
  _tryDestroy () {
    if (!this.pendingDestroy ||
        this.renderTasks.length !== 0 ||
        this.receivingOperatorList) {
      return;
    }

    delete this.operatorList;
    delete this.displayReadyPromise;
    this.objs.clear();
    this.pendingDestroy = false;
  }
  /**
   * For internal use only.
   */
  _startRenderPage (transparency) {
    this.displayReadyPromise.resolve(transparency);
  }
  /**
   * For internal use only.
   */
  _renderPageChunk (operatorListChunk) {
    // Add the new chunk to the current operator list.
    for (var i = 0, ii = operatorListChunk.length; i < ii; i++) {
      this.operatorList.fnArray.push(operatorListChunk.fnArray[i]);
      this.operatorList.argsArray.push(operatorListChunk.argsArray[i]);
    }
    this.operatorList.lastChunk = operatorListChunk.lastChunk;

    // Notify all the rendering tasks there are more operators to be consumed.
    for (var i = 0; i < this.renderTasks.length; i++) {
      this.renderTasks[i].operatorListChanged();
    }

    if (operatorListChunk.lastChunk) {
      this.receivingOperatorList = false;
      this._tryDestroy();
    }
  }
}

/**
 * For internal use only.
 */
class WorkerTransport {
  constructor (workerReadyPromise) {
    this.workerReadyPromise = workerReadyPromise;
    this.commonObjs = new PDFObjects();

    this.pageCache = [];
    this.pagePromises = [];
    this.embeddedFontsUsed = false;

    this.setupFakeWorker();
  }

  destroy () {
    this.pageCache = [];
    this.pagePromises = [];
    var self = this;
    this.messageHandler.send('Terminate', null, function () {
      if (self.worker) {
        self.worker.terminate();
      }
    });
  }

  setupFakeWorker () {
    // If we don't use a worker, just post/sendMessage to the main thread.
    const fakeWorker = {
      postMessage: function WorkerTransport_postMessage(obj) {
        fakeWorker.onmessage({ data: obj });
      },
      terminate: function WorkerTransport_terminate() {}
    };

    // defines `onmessage`
    const messageHandler = new MessageHandler('main', fakeWorker);
    this.setupMessageHandler(messageHandler);

    // If the main thread is our worker, setup the handling for the messages
    // the main thread sends to it self.
    PDFJS.WorkerMessageHandler.setup(messageHandler);
  }

  setupMessageHandler (messageHandler) {
    this.messageHandler = messageHandler;

    messageHandler.on('GetDoc', function transportDoc(data) {
      var pdfInfo = data.pdfInfo;
      var pdfDocument = new PDFDocumentProxy(pdfInfo, this);
      this.pdfDocument = pdfDocument;
      this.workerReadyPromise.resolve(pdfDocument);
    }, this);

    messageHandler.on('InvalidPDF', function transportInvalidPDF(data) {
      this.workerReadyPromise.reject(data.exception.name, data.exception);
    }, this);

    messageHandler.on('MissingPDF', function transportMissingPDF(data) {
      this.workerReadyPromise.reject(data.exception.message, data.exception);
    }, this);

    messageHandler.on('UnknownError', function transportUnknownError(data) {
      this.workerReadyPromise.reject(data.exception.message, data.exception);
    }, this);

    messageHandler.on('GetPage', function transportPage(data) {
      var pageInfo = data.pageInfo;
      var page = new PDFPageProxy(pageInfo, this);
      this.pageCache[pageInfo.pageIndex] = page;
      var promise = this.pagePromises[pageInfo.pageIndex];
      promise.resolve(page);
    }, this);

    messageHandler.on('StartRenderPage', function transportRender(data) {
      var page = this.pageCache[data.pageIndex];
      page._startRenderPage(data.transparency);
    }, this);

    messageHandler.on('RenderPageChunk', function transportRender(data) {
      var page = this.pageCache[data.pageIndex];

      page._renderPageChunk(data.operatorList);
    }, this);

    messageHandler.on('commonobj', function transportObj(data) {
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
    }, this);

    messageHandler.on('obj', function transportObj(data) {
      var id = data[0];
      var pageIndex = data[1];
      var type = data[2];
      var pageProxy = this.pageCache[pageIndex];
      if (pageProxy.objs.hasData(id))
        return;

      switch (type) {
        case 'Image':
          var imageData = data[3];
          pageProxy.objs.resolve(id, imageData);

          // heuristics that will allow not to store large data
          var MAX_IMAGE_SIZE_TO_STORE = 8000000;
          if ('data' in imageData &&
              imageData.data.length > MAX_IMAGE_SIZE_TO_STORE) {
            pageProxy.cleanupAfterRender = true;
          }
          break;
        default:
          throw new Error('Got unknown object type ' + type);
      }
    }, this);

    messageHandler.on('DocError', function transportDocError(data) {
      this.workerReadyPromise.reject(data);
    }, this);

    messageHandler.on('PageError', function transportError(data) {
      var page = this.pageCache[data.pageNum - 1];
      if (page.displayReadyPromise)
        page.displayReadyPromise.reject(data.error);
      else
        throw new Error(data.error);
    }, this);

    messageHandler.on('JpegDecode', function(data, promise) {
      var imageUrl = data[0];
      var components = data[1];
      if (components != 3 && components != 1)
        throw new Error('Only 3 component or 1 component can be returned');

      var img = new Image();
      img.onload = (function messageHandler_onloadClosure() {
        var width = img.width;
        var height = img.height;
        var size = width * height;
        var rgbaLength = size * 4;
        var buf = new Uint8Array(size * components);
        var tmpCanvas = createScratchCanvas(width, height);
        var tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var data = tmpCtx.getImageData(0, 0, width, height).data;

        if (components == 3) {
          for (var i = 0, j = 0; i < rgbaLength; i += 4, j += 3) {
            buf[j] = data[i];
            buf[j + 1] = data[i + 1];
            buf[j + 2] = data[i + 2];
          }
        } else if (components == 1) {
          for (var i = 0, j = 0; i < rgbaLength; i += 4, j++) {
            buf[j] = data[i];
          }
        }
        promise.resolve({ data: buf, width: width, height: height});
      }).bind(this);
//MQZ. Oct.17.2012 - disable image drawing
//          img.src = imageUrl;
        img.src = 'data:image/jpeg;base64,' + img.btoa(imageUrl);
    });
  }

  fetchDocument (source) {
    source.disableAutoFetch = false;
    source.chunkedViewerLoading = false //!!this.pdfDataRangeTransport;
    this.messageHandler.send('GetDocRequest', {
      source,
      disableRange: false,
      maxImageSize: -1,
    });
  }

  getData (promise) {
    this.messageHandler.send('GetData', null, function(data) {
      promise.resolve(data);
    });
  }

  dataLoaded () {
    var promise = new PDFJS.Promise();
    this.messageHandler.send('DataLoaded', null, function(args) {
      promise.resolve(args);
    });
    return promise;
  }

  getPage (pageNumber, promise) {
    var pageIndex = pageNumber - 1;
    if (pageIndex in this.pagePromises)
      return this.pagePromises[pageIndex];
    var promise = new PDFJS.Promise('Page ' + pageNumber);
    this.pagePromises[pageIndex] = promise;
    this.messageHandler.send('GetPageRequest', { pageIndex: pageIndex });
    return promise;
  }

  getPageIndex (ref) {
    var promise = new PDFJS.Promise();
    this.messageHandler.send('GetPageIndex', { ref: ref },
      function (pageIndex) {
        promise.resolve(pageIndex);
      }
    );
    return promise;
  }

  getAnnotations (pageIndex) {
    this.messageHandler.send('GetAnnotationsRequest',
      { pageIndex: pageIndex });
  }

  getDestinations () {
    var promise = new PDFJS.Promise();
    this.messageHandler.send('GetDestinations', null,
      function transportDestinations(destinations) {
        promise.resolve(destinations);
      }
    );
    return promise;
  }
  startCleanup () {
    this.messageHandler.send('Cleanup', null,
      function endCleanup() {
        for (var i = 0, ii = this.pageCache.length; i < ii; i++) {
          var page = this.pageCache[i];
          if (page) {
            page.destroy();
          }
        }
        this.commonObjs.clear();
//MQZ Dec.03.2013 disable FontLoader
//          FontLoader.clear();
      }.bind(this)
    );
  }
}

/**
 * A PDF document and page is built of many objects. E.g. there are objects
 * for fonts, images, rendering code and such. These objects might get processed
 * inside of a worker. The `PDFObjects` implements some basic functions to
 * manage these objects.
 */
var PDFObjects = (function PDFObjectsClosure() {
  function PDFObjects() {
    this.objs = {};
  }

  PDFObjects.prototype = {
    /**
     * Internal function.
     * Ensures there is an object defined for `objId`.
     */
    ensureObj: function PDFObjects_ensureObj(objId) {
      if (this.objs[objId])
        return this.objs[objId];

      var obj = {
        promise: new Promise(objId),
        data: null,
        resolved: false
      };
      this.objs[objId] = obj;

      return obj;
    },

    /**
     * If called *without* callback, this returns the data of `objId` but the
     * object needs to be resolved. If it isn't, this function throws.
     *
     * If called *with* a callback, the callback is called with the data of the
     * object once the object is resolved. That means, if you call this
     * function and the object is already resolved, the callback gets called
     * right away.
     */
    get: function PDFObjects_get(objId, callback) {
      // If there is a callback, then the get can be async and the object is
      // not required to be resolved right now
      if (callback) {
        this.ensureObj(objId).promise.then(callback);
        return null;
      }

      // If there isn't a callback, the user expects to get the resolved data
      // directly.
      var obj = this.objs[objId];

      // If there isn't an object yet or the object isn't resolved, then the
      // data isn't ready yet!
      if (!obj || !obj.resolved)
        throw new Error('Requesting object that isn\'t resolved yet ' + objId);

      return obj.data;
    },

    /**
     * Resolves the object `objId` with optional `data`.
     */
    resolve: function PDFObjects_resolve(objId, data) {
      var obj = this.ensureObj(objId);

      obj.resolved = true;
      obj.data = data;
      obj.promise.resolve(data);
    },

    isResolved: function PDFObjects_isResolved(objId) {
      var objs = this.objs;

      if (!objs[objId]) {
        return false;
      } else {
        return objs[objId].resolved;
      }
    },

    hasData: function PDFObjects_hasData(objId) {
      return this.isResolved(objId);
    },

    /**
     * Returns the data of `objId` if object exists, null otherwise.
     */
    getData: function PDFObjects_getData(objId) {
      var objs = this.objs;
      if (!objs[objId] || !objs[objId].resolved) {
        return null;
      } else {
        return objs[objId].data;
      }
    },

    clear: function PDFObjects_clear() {
      this.objs = {};
    }
  };
  return PDFObjects;
})();
/*
 * RenderTask is basically a promise but adds a cancel function to terminate it.
 */
var RenderTask = (function RenderTaskClosure() {
  function RenderTask(internalRenderTask) {
    this.internalRenderTask = internalRenderTask;
    Promise.call(this);
  }

  RenderTask.prototype = Object.create(Promise.prototype);

  /**
   * Cancel the rendering task. If the task is curently rendering it will not be
   * cancelled until graphics pauses with a timeout. The promise that this
   * object extends will resolved when cancelled.
   */
  RenderTask.prototype.cancel = function RenderTask_cancel() {
    this.internalRenderTask.cancel();
  };

  return RenderTask;
})();

var InternalRenderTask = (function InternalRenderTaskClosure() {

  function InternalRenderTask(callback, params, objs, commonObjs, operatorList,
                              pageNumber) {
    this.callback = callback;
    this.params = params;
    this.objs = objs;
    this.commonObjs = commonObjs;
    this.operatorListIdx = null;
    this.operatorList = operatorList;
    this.pageNumber = pageNumber;
    this.running = false;
    this.graphicsReadyCallback = null;
    this.graphicsReady = false;
    this.cancelled = false;
  }

  InternalRenderTask.prototype = {

    initalizeGraphics:
        function InternalRenderTask_initalizeGraphics(transparency) {

      if (this.cancelled) {
        return;
      }

      var params = this.params;
      this.gfx = new CanvasGraphics(params.canvasContext, this.commonObjs,
                                    this.objs, params.textLayer,
                                    params.imageLayer);

      this.gfx.beginDrawing(params.viewport, transparency);
      this.operatorListIdx = 0;
      this.graphicsReady = true;
      if (this.graphicsReadyCallback) {
        this.graphicsReadyCallback();
      }
    },

    cancel: function InternalRenderTask_cancel() {
      this.running = false;
      this.cancelled = true;
      this.callback('cancelled');
    },

    operatorListChanged: function InternalRenderTask_operatorListChanged() {
      if (!this.graphicsReady) {
        if (!this.graphicsReadyCallback) {
          this.graphicsReadyCallback = this._continue.bind(this);
        }
        return;
      }

      if (this.stepper) {
        this.stepper.updateOperatorList(this.operatorList);
      }

      if (this.running) {
        return;
      }
      this._continue();
    },

    _continue: function InternalRenderTask__continue() {
      this.running = true;
      if (this.cancelled) {
        return;
      }
      if (this.params.continueCallback) {
        this.params.continueCallback(this._next.bind(this));
      } else {
        this._next();
      }
    },

    _next: function InternalRenderTask__next() {
      if (this.cancelled) {
        return;
      }
      this.operatorListIdx = this.gfx.executeOperatorList(this.operatorList,
                                        this.operatorListIdx,
                                        this._continue.bind(this),
                                        this.stepper);
      if (this.operatorListIdx === this.operatorList.argsArray.length) {
        this.running = false;
        if (this.operatorList.lastChunk) {
          this.gfx.endDrawing();
          this.callback();
        }
      }
    }

  };

  return InternalRenderTask;
})();
