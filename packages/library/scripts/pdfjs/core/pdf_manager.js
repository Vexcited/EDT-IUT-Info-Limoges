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
/* globals NotImplementedException, MissingDataException, Promise, Stream,
           PDFDocument,  */

'use strict';

class BasePdfManager {
  pdfModel;
  passwordChangedPromise;
  
  constructor () {
  }

  onLoadedStream () {
    throw new NotImplementedException();
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

  async ensure (obj, prop, args) {
    return new NotImplementedException();
  }

  async requestRange (begin, end) {
    return new NotImplementedException();
  }

  async requestLoadedStream () {
    return new NotImplementedException();
  }

  updatePassword (password) {
    this.pdfModel.xref.password = this.password = password;
    if (this.passwordChangedPromise) {
      this.passwordChangedPromise.resolve();
    }
  }

  terminate () {
    return new NotImplementedException();
  }
}

class LocalPdfManager extends BasePdfManager {
  loadedStream;

  constructor (data, password) {
    super();

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

  terminate () {
  }
}
