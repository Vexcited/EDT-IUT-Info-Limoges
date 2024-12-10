import { assert, isArray, isArrayBuffer, isName, isStream, isString, shadow, stringToBytes, stringToPDFString, Util } from "../shared/util";
import { calculateMD5 } from "./crypto";
import { OperatorList, PartialEvaluator } from "./evaluator";
import { Catalog, ObjectLoader, XRef } from "./obj";
import { Lexer, Linearization } from "./parser";
import { NullStream, Stream, StreamsSequenceStream } from "./stream";

export class Page {
  constructor (pdfManager, xref, pageIndex, pageDict, ref, fontCache) {
    this.pdfManager = pdfManager;
    this.pageIndex = pageIndex;
    this.pageDict = pageDict;
    this.xref = xref;
    this.ref = ref;
    this.fontCache = fontCache;
    this.idCounters = {
      obj: 0
    };
    this.resourcesPromise = null;
  }

  getPageProp (key) {
    return this.pageDict.get(key);
  }

  inheritPageProp (key) {
    var dict = this.pageDict;
    var obj = dict.get(key);
    while (obj === undefined) {
      dict = dict.get('Parent');
      if (!dict)
        break;
      obj = dict.get(key);
    }
    return obj;
  }

  get content() {
    return this.getPageProp('Contents');
  }

  get resources() {
    return shadow(this, 'resources', this.inheritPageProp('Resources'));
  }

  get mediaBox() {
    var obj = this.inheritPageProp('MediaBox');
    // Reset invalid media box to letter size.
    if (!isArray(obj) || obj.length !== 4)
      obj = [0, 0, 612, 792];
    return shadow(this, 'mediaBox', obj);
  }

  get view() {
    var mediaBox = this.mediaBox;
    var cropBox = this.inheritPageProp('CropBox');
    if (!isArray(cropBox) || cropBox.length !== 4)
      return shadow(this, 'view', mediaBox);

    // From the spec, 6th ed., p.963:
    // "The crop, bleed, trim, and art boxes should not ordinarily
    // extend beyond the boundaries of the media box. If they do, they are
    // effectively reduced to their intersection with the media box."
    cropBox = Util.intersect(cropBox, mediaBox);
    if (!cropBox)
      return shadow(this, 'view', mediaBox);

    return shadow(this, 'view', cropBox);
  }

  get rotate() {
    var rotate = this.inheritPageProp('Rotate') || 0;
    // Normalize rotation so it's a multiple of 90 and between 0 and 270
    if (rotate % 90 !== 0) {
      rotate = 0;
    } else if (rotate >= 360) {
      rotate = rotate % 360;
    } else if (rotate < 0) {
      // The spec doesn't cover negatives, assume its counterclockwise
      // rotation. The following is the other implementation of modulo.
      rotate = ((rotate % 360) + 360) % 360;
    }
    return shadow(this, 'rotate', rotate);
  }

  getContentStream () {
    var content = this.content;
    var stream;
    if (isArray(content)) {
      // fetching items
      var xref = this.xref;
      var i, n = content.length;
      var streams = [];
      for (i = 0; i < n; ++i)
        streams.push(xref.fetchIfRef(content[i]));
      stream = new StreamsSequenceStream(streams);
    } else if (isStream(content)) {
      stream = content;
    } else {
      // replacing non-existent page content with empty one
      stream = new NullStream();
    }
    return stream;
  }

  async loadResources (keys) {
    if (!this.resourcesPromise) {
      // TODO: add async inheritPageProp and remove this.
      this.resourcesPromise = this.pdfManager.ensure(this, 'resources');
    }
    
    // empty page
    if (!this.resources) return;
    await this.resourcesPromise;

    var objectLoader = new ObjectLoader(
      this.resources.map,
      keys,
      this.xref
    );

    objectLoader.load()
  }

  async getOperatorList (handler) {
    var contentStreamPromise = this.pdfManager.ensure(
      this, 'getContentStream', []
    );

    var resourcesPromise = this.loadResources([
      'ExtGState',
      'ColorSpace',
      'Pattern',
      'Shading',
      'XObject',
      'Font'
      // ProcSet
      // Properties
    ]);

    var partialEvaluator = new PartialEvaluator(
      this.pdfManager, this.xref, handler,
      this.pageIndex, 'p' + this.pageIndex + '_',
      this.idCounters, this.fontCache
    );

    var data = await Promise.all([
      contentStreamPromise,
      resourcesPromise
    ]);

    var contentStream = data[0];
    var opList = new OperatorList(handler, this.pageIndex);

    handler.StartRenderPage({
      pageIndex: this.pageIndex
    });

    partialEvaluator.getOperatorList(contentStream, this.resources, opList);
    opList.flush(true);
  }
}

export const DocumentInfoValidators = {
  get entries() {
    // Lazily build this since all the validation functions below are not
    // defined until after this file loads.
    return shadow(this, 'entries', {
      Title: isString,
      Author: isString,
      Subject: isString,
      Keywords: isString,
      Creator: isString,
      Producer: isString,
      CreationDate: isString,
      ModDate: isString,
      Trapped: isName
    });
  }
};

/**
 * The `PDFDocument` holds all the data of the PDF file. Compared to the
 * `PDFDoc`, this one doesn't have any job management code.
 * Right now there exists one PDFDocument on the main thread + one object
 * for each worker. If there is no worker support enabled, there are two
 * `PDFDocument` objects on the main thread created.
 */
export class PDFDocument {
  constructor (pdfManager, arg) {
    const init = (pdfManager, stream) => {
      assert(stream.length > 0, 'stream must have data');
      this.pdfManager = pdfManager;
      this.stream = stream;
      var xref = new XRef(this.stream);
      this.xref = xref;
    };

    if (isStream(arg))
      init(pdfManager, arg);
    else if (isArrayBuffer(arg))
      init(pdfManager, new Stream(arg));
    else
      throw new Error('PDFDocument: Unknown argument type');
  }

  /** @private */
  static find(stream, needle, limit, backwards) {
    var pos = stream.pos;
    var end = stream.end;
    var str = '';
    if (pos + limit > end)
      limit = end - pos;
    for (var n = 0; n < limit; ++n)
      str += String.fromCharCode(stream.getByte());
    stream.pos = pos;
    var index = backwards ? str.lastIndexOf(needle) : str.indexOf(needle);
    if (index == -1)
      return false; /* not found */
    stream.pos += index;
    return true; /* found */
  }

  parse (recoveryMode) {
    this.setup(recoveryMode);
    try {
      // checking if AcroForm is present
      this.acroForm = this.catalog.catDict.get('AcroForm');
      if (this.acroForm) {
        this.xfa = this.acroForm.get('XFA');
        var fields = this.acroForm.get('Fields');
        if ((!fields || !isArray(fields) || fields.length === 0) &&
            !this.xfa) {
          // no fields and no XFA -- not a form (?)
          this.acroForm = null;
        }
      }
    } catch (ex) {
      console.info('Something wrong with AcroForm entry');
      this.acroForm = null;
    }
  }

  get linearization() {
    var length = this.stream.length;
    var linearization = false;
    if (length) {
      try {
        linearization = new Linearization(this.stream);
        if (linearization.length != length) {
          linearization = false;
        }
      }
      catch {
        console.warn('The linearization data is not available ' +
              'or unreadable PDF data is found');
        linearization = false;
      }
    }
    // shadow the prototype getter with a data property
    return shadow(this, 'linearization', linearization);
  }

  get startXRef() {
    var stream = this.stream;
    var startXRef = 0;
    var linearization = this.linearization;
    if (linearization) {
      // Find end of first obj.
      stream.reset();
      if (PDFDocument.find(stream, 'endobj', 1024))
        startXRef = stream.pos + 6;
    } else {
      // Find startxref by jumping backward from the end of the file.
      var step = 1024;
      var found = false, pos = stream.end;
      while (!found && pos > 0) {
        pos -= step - 'startxref'.length;
        if (pos < 0)
          pos = 0;
        stream.pos = pos;
        found = PDFDocument.find(stream, 'startxref', step, true);
      }
      if (found) {
        stream.skip(9);
        var ch;
        do {
          ch = stream.getByte();
        } while (Lexer.isSpace(ch));
        var str = '';
        while (ch >= 0x20 && ch <= 0x39) { // < '9'
          str += String.fromCharCode(ch);
          ch = stream.getByte();
        }
        startXRef = parseInt(str, 10);
        if (isNaN(startXRef))
          startXRef = 0;
      }
    }
    // shadow the prototype getter with a data property
    return shadow(this, 'startXRef', startXRef);
  }

  get mainXRefEntriesOffset() {
    var mainXRefEntriesOffset = 0;
    var linearization = this.linearization;
    if (linearization)
      mainXRefEntriesOffset = linearization.mainXRefEntriesOffset;
    // shadow the prototype getter with a data property
    return shadow(this, 'mainXRefEntriesOffset', mainXRefEntriesOffset);
  }

  // Find the header, remove leading garbage and setup the stream
  // starting from the header.
  checkHeader () {
    var stream = this.stream;
    stream.reset();
    if (PDFDocument.find(stream, '%PDF-', 1024)) {
      // Found the header, trim off any garbage before it.
      stream.moveStart();
      // Reading file format version
      var MAX_VERSION_LENGTH = 12;
      var version = '', ch;
      while ((ch = stream.getByte()) > 0x20) { // SPACE
        if (version.length >= MAX_VERSION_LENGTH) {
          break;
        }
        version += String.fromCharCode(ch);
      }
      // removing "%PDF-"-prefix
      this.pdfFormatVersion = version.substring(5);
      return;
    }
    // May not be a PDF file, continue anyway.
  }

  parseStartXRef () {
    var startXRef = this.startXRef;
    this.xref.setStartXRef(startXRef);
  }

  setup (recoveryMode) {
    this.xref.parse(recoveryMode);
    this.catalog = new Catalog(this.pdfManager, this.xref);
  }

  get numPages() {
    var linearization = this.linearization;
    var num = linearization ? linearization.numPages : this.catalog.numPages;
    // shadow the prototype getter
    return shadow(this, 'numPages', num);
  }

  get documentInfo() {
    var docInfo = {
      PDFFormatVersion: this.pdfFormatVersion,
      IsAcroFormPresent: !!this.acroForm,
      IsXFAPresent: !!this.xfa
    };
    var infoDict;
    try {
      infoDict = this.xref.trailer.get('Info');
    } catch (err) {
      console.info('The document information dictionary is invalid.');
    }
    if (infoDict) {
      var validEntries = DocumentInfoValidators.entries;
      // Only fill the document info with valid entries from the spec.
      for (var key in validEntries) {
        if (infoDict.has(key)) {
          var value = infoDict.get(key);
          // Make sure the value conforms to the spec.
          if (validEntries[key](value)) {
            docInfo[key] = typeof value !== 'string' ? value :
              stringToPDFString(value);
          } else {
            console.info('Bad value in document info for "' + key + '"');
          }
        }
      }
    }

    return shadow(this, 'documentInfo', docInfo);
  }

  get fingerprint() {
    var xref = this.xref, hash, fileID = '';

    if (xref.trailer.has('ID')) {
      hash = stringToBytes(xref.trailer.get('ID')[0]);
    } else {
      hash = calculateMD5(this.stream.bytes.subarray(0, 100), 0, 100);
    }

    for (var i = 0, n = hash.length; i < n; i++) {
      fileID += hash[i].toString(16);
    }

    return shadow(this, 'fingerprint', fileID);
  }


  getPage (pageIndex) {
    return this.catalog.getPage(pageIndex);
  }


  cleanup () {
    return this.catalog.cleanup();
  }
}
