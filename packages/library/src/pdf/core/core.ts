import { assert, isArray, isArrayBuffer, isName, isStream, isString, shadow, stringToBytes, stringToPDFString, Util } from "../shared/util";
import { OperatorList, PartialEvaluator } from "./evaluator";
import { Catalog, ObjectLoader, Ref, RefSetCache, XRef } from "./obj";
import { Lexer } from "./parser";
import { LocalPdfManager } from "./pdf_manager";
import { NullStream, Stream } from "./stream";
import { Dict } from "./obj";
import { WorkerTransport } from "../display/api";

export class Page {
  public resourcesPromise: Promise<any> | null = null;
  public idCounters = {
    obj: 0
  }

  constructor (
    public pdfManager: LocalPdfManager,
    public xref: XRef,
    public pageIndex: number,
    public pageDict: Dict,
    public ref: Ref,
    public fontCache: RefSetCache
  ) {}

  getPageProp (key: string) {
    return this.pageDict.get(key);
  }

  inheritPageProp (key: string) {
    let dict = this.pageDict;
    let obj = dict.get(key);

    while (obj === undefined) {
      // @ts-expect-error
      dict = dict.get('Parent');
      if (!dict) break;
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
    var obj = this.inheritPageProp('MediaBox') as unknown as number[];
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
    // @ts-expect-error
    cropBox = Util.intersect(cropBox, mediaBox);
    if (!cropBox)
      return shadow(this, 'view', mediaBox);

    return shadow(this, 'view', cropBox);
  }

  get rotate() {
    // TODO
    var rotate = this.inheritPageProp('Rotate') as unknown as number || 0;
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

  getContentStream (): Stream {
    if (isStream(this.content)) {
      return this.content;
    }
    else {
      // replacing non-existent page content with empty one
      return new NullStream();
    }
  }

  async loadResources (keys: string[]) {
    if (!this.resourcesPromise) {
      // TODO: add async inheritPageProp and remove this.
      this.resourcesPromise = this.pdfManager.ensure(this, 'resources');
    }
    
    // empty page
    if (!this.resources) return;
    await this.resourcesPromise;

    const objectLoader = new ObjectLoader(
      this.resources.map,
      keys,
      this.xref
    );

    objectLoader.load();
  }

  async getOperatorList (handler: WorkerTransport) {
    const contentStreamPromise = this.pdfManager.ensure(
      this, 'getContentStream', []
    );

    const resourcesPromise = this.loadResources([
      'ExtGState',
      'ColorSpace',
      'Pattern',
      'Shading',
      'XObject',
      'Font'
    ]);

    const partialEvaluator = new PartialEvaluator(
      this.pdfManager, this.xref, handler,
      this.pageIndex, 'p' + this.pageIndex + '_',
      this.idCounters, this.fontCache
    );

    const data = await Promise.all([
      contentStreamPromise,
      resourcesPromise
    ]);

    const contentStream = data[0];
    const opList = new OperatorList(handler, this.pageIndex);

    handler.StartRenderPage({
      pageIndex: this.pageIndex
    });

    partialEvaluator.getOperatorList(contentStream, this.resources, opList);
    opList.flush(true);
  }
}

export const DocumentInfoValidators = {
  get entries () {
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
  public pdfFormatVersion?: string;
  public catalog?: Catalog;
  public stream: Stream;
  public xref: XRef;

  constructor (
    public pdfManager: LocalPdfManager,
    arg: Stream | ArrayBuffer
  ) {
    if (isStream(arg)) {
      assert(arg.length > 0, 'stream must have data')
      this.stream = arg;
    }
    else if (isArrayBuffer(arg)) {
      this.stream = new Stream(arg)
    }
    else throw new Error('PDFDocument: Unknown argument type');

    this.xref = new XRef(this.stream);
  }

  private static find (stream: Stream, needle: string, limit: number, backwards?: boolean): boolean {
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

  parse (recoveryMode: boolean): void {
    this.setup(recoveryMode);
  }

  get linearization() {
    // shadow the prototype getter with a data property
    return shadow(this, 'linearization', false);
  }

  get startXRef () {
    const stream = this.stream;
    let startXRef = 0;

    // Find startxref by jumping backward from the end of the file.
    const step = 1024;
    let found = false;
    let pos = stream.end;

    while (!found && pos > 0) {
      pos -= step - 'startxref'.length;
      if (pos < 0)
        pos = 0;
      stream.pos = pos;
      found = PDFDocument.find(stream, 'startxref', step, true);
    }

    if (found) {
      stream.skip(9);
      let ch: number;

      do {
        ch = stream.getByte();
      } while (Lexer.isSpace(ch));
      
      let str = '';
      
      while (ch >= 0x20 && ch <= 0x39) { // < '9'
        str += String.fromCharCode(ch);
        ch = stream.getByte();
      }

      startXRef = parseInt(str, 10);
      if (isNaN(startXRef)) {
        startXRef = 0;
      }
    }

    // shadow the prototype getter with a data property
    return shadow(this, 'startXRef', startXRef);
  }

  get mainXRefEntriesOffset () {
    // shadow the prototype getter with a data property
    return shadow(this, 'mainXRefEntriesOffset', 0);
  }

  // Find the header, remove leading garbage and setup the stream
  // starting from the header.
  checkHeader (): void {
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

  parseStartXRef (): void {
    var startXRef = this.startXRef;
    this.xref.setStartXRef(startXRef);
  }

  setup (recoveryMode: boolean): void {
    this.xref.parse(recoveryMode);
    this.catalog = new Catalog(this.pdfManager, this.xref);
  }

  get numPages (): number {
    // shadow the prototype getter
    return shadow(this, 'numPages', this.catalog!.numPages);
  }

  get documentInfo () {
    const docInfo = { PDFFormatVersion: this.pdfFormatVersion };
    let infoDict;

    try {
      infoDict = this.xref.trailer?.get('Info');
    }
    catch (err) {
      console.info('the document information dictionary is invalid.');
    }

    if (infoDict) {
      var validEntries = DocumentInfoValidators.entries;
      // Only fill the document info with valid entries from the spec.
      for (var key in validEntries) {
        // @ts-expect-error
        if (infoDict.has(key)) {
          // @ts-expect-error
          var value = infoDict.get(key);
          // Make sure the value conforms to the spec.
          if (validEntries[key](value)) {
            // @ts-expect-error
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

    if (xref.trailer!.has('ID')) {
      // @ts-expect-error
      hash = stringToBytes(xref.trailer.get('ID')[0]);
    }

    // @ts-expect-error
    for (var i = 0, n = hash.length; i < n; i++) {
      // @ts-expect-error
      fileID += hash[i].toString(16);
    }

    return shadow(this, 'fingerprint', fileID);
  }


  getPage (pageIndex: number) {
    return this.catalog!.getPage(pageIndex);
  }


  cleanup (): void {
    return this.catalog!.cleanup();
  }
}
