'use strict';

class LocalPdfManager {
  loadedStream;

  constructor (data, password) {
    const stream = new Stream(data);
    this.pdfModel = new PDFDocument(this, stream, password);
    this.loadedStream = new Promise();
    this.loadedStream.resolve(stream);
  }

  async ensure (obj, prop, args) {
    let value = obj[prop];
    
    if (typeof(value) === 'function') {
      value = value.apply(obj, args);
    }

    return value;
  }

  async requestRange (begin, end) {
  }

  requestLoadedStream () {
  }

  async onLoadedStream () {
    return this.loadedStream;
  }

  ensureModel (prop, args) {
    return this.ensure(this.pdfModel, prop, args);
  }

  ensureXRef (prop, args) {
    return this.ensure(this.pdfModel.xref, prop, args);
  }

  ensureCatalog (prop, args) {
    return this.ensure(this.pdfModel.catalog, prop, args);
  }

  getPage (pageIndex) {
    return this.pdfModel.getPage(pageIndex);
  }

  cleanup () {
    return this.pdfModel.cleanup();
  }

  terminate () {
  }
}
