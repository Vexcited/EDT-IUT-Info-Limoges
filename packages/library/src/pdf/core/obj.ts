import { assert, bytesToString, isArray, isCmd, isDict, isInt, isName, isRef, isStream, shadow, stringToPDFString, stringToUTF8String } from "../shared/util";
import { Page } from "./core";
import { Lexer, Parser } from "./parser";
import { LocalPdfManager } from "./pdf_manager";
import { Stream } from "./stream";

export class Name {
  constructor (public name: string) {}
}

export class Cmd {
  constructor (public cmd: string) {}
  private static cache: Record<string, Cmd> = {};

  static get (cmd: string): Cmd {
    const value = Cmd.cache[cmd];
    if (value) return value;

    return Cmd.cache[cmd] = new Cmd(cmd);
  }
}

export class Dict {
  public map: Record<string, XRef> = {};
  constructor (public xref?: XRef) {}

  assignXref (xref: XRef): void {
    this.xref = xref;
  }

  // automatically dereferences Ref objects
  get (key1: string, key2?: string, key3?: string): XRef | undefined {
    var value;
    var xref = this.xref;
    if (typeof (value = this.map[key1]) != 'undefined' || key1 in this.map ||
        typeof key2 == 'undefined') {
      return xref ? xref.fetchIfRef(value) : value;
    }
    if (typeof (value = this.map[key2]) != 'undefined' || key2 in this.map ||
        typeof key3 == 'undefined') {
      return xref ? xref.fetchIfRef(value) : value;
    }

    value = this.map[key3] || null;
    return xref ? xref.fetchIfRef(value) : value;
  }

  // Same as get(), but returns a promise and uses fetchIfRefAsync().
  async getAsync (key1: string, key2?: string, key3?: string): Promise<XRef | undefined> {
    let value;
    const xref = this.xref;

    if (typeof (value = this.map[key1]) !== undefined || key1 in this.map ||
        typeof key2 === undefined) {
      if (xref) {
        return xref.fetchIfRefAsync(value);
      }
      return value;
    }

    if (typeof (value = this.map[key2 as string]) !== undefined || key2 as string in this.map ||
      typeof key3 === undefined
    ) {
      if (xref) {
        return xref.fetchIfRefAsync(value);
      }

      return value;
    }

    value = this.map[key3 as string] || null;
    if (xref) {
      return xref.fetchIfRefAsync(value);
    }

    return value;
  }

  // no dereferencing
  getRaw (key: string): XRef | undefined {
    return this.map[key];
  }

  // creates new map and dereferences all Refs
  getAll () {
    const all: Record<string, XRef> = {};
    
    for (const key in this.map) {
      const obj = this.get(key);
      all[key] = obj instanceof Dict ? obj.getAll() : obj;
    }
    
    return all;
  }

  set (key: string, value: XRef): void {
    this.map[key] = value;
  }

  has (key: string): boolean {
    return key in this.map;
  }

  forEach (callback: (key: string, value: XRef | undefined) => void): void {
    for (const key in this.map) {
      callback(key, this.get(key));
    }
  }
}

export class Ref {
  constructor (
    public num: number,
    public gen: number
  ) {}
}

/**
 * The reference is identified by number and generation,
 * this structure stores only one instance of the reference.
 */
export class RefSet {
  public dict: Record<string, boolean> = {};

  has (ref: Ref): boolean {
    return ('R' + ref.num + '.' + ref.gen) in this.dict;
  }

  /**
   * @param {Ref} ref 
   * @returns {void}
   */
  put (ref) {
    this.dict['R' + ref.num + '.' + ref.gen] = true;
  }
  
  /**
   * @param {Ref} ref 
   * @returns {void}
   */
  remove (ref) {
    delete this.dict['R' + ref.num + '.' + ref.gen];
  }
}

export class RefSetCache {
  constructor () {
    this.dict = Object.create(null);
  }

  get (ref) {
    return this.dict['R' + ref.num + '.' + ref.gen];
  }

  has (ref) {
    //MQZ. 03/08/2016 fix https://github.com/modesty/pdf2json/issues/26
    return !!ref ? ('R' + ref.num + '.' + ref.gen) in this.dict : false;
  }

  put (ref, obj) {
    this.dict['R' + ref.num + '.' + ref.gen] = obj;
  }

  forEach (fn, thisArg) {
    for (var i in this.dict) {
      fn.call(thisArg, this.dict[i]);
    }
  }

  clear () {
    this.dict = Object.create(null);
  }
}

export class Catalog {
  constructor (public pdfManager: LocalPdfManager, public xref: XRef) {
    this.catDict = xref.getCatalogObj();
    this.fontCache = new RefSetCache();
    assert(isDict(this.catDict), 'catalog object is not a dictionary');

    this.pagePromises = [];
  }

  get metadata() {
    var streamRef = this.catDict.getRaw('Metadata');
    if (!isRef(streamRef))
      return shadow(this, 'metadata', null);

    var encryptMetadata = !this.xref.encrypt ? false :
      this.xref.encrypt.encryptMetadata;

    var stream = this.xref.fetch(streamRef, !encryptMetadata);
    var metadata;
    if (stream && isDict(stream.dict)) {
      var type = stream.dict.get('Type');
      var subtype = stream.dict.get('Subtype');

      if (isName(type) && isName(subtype) &&
          type.name === 'Metadata' && subtype.name === 'XML') {
        // XXX: This should examine the charset the XML document defines,
        // however since there are currently no real means to decode
        // arbitrary charsets, let's just hope that the author of the PDF
        // was reasonable enough to stick with the XML default charset,
        // which is UTF-8.
        metadata = stringToUTF8String(bytesToString(stream.getBytes()));
        try {
        } catch (e) {
          console.info('Skipping invalid metadata.');
        }
      }
    }

    return shadow(this, 'metadata', metadata);
  }

  get toplevelPagesDict() {
    var pagesObj = this.catDict.get('Pages');
    assert(isDict(pagesObj), 'invalid top-level pages dictionary');
    // shadow the prototype getter
    return shadow(this, 'toplevelPagesDict', pagesObj);
  }

  get documentOutline() {
    var obj = null;
    try {
      obj = this.readDocumentOutline();
    } catch {
      console.warn('Unable to read document outline');
    }
    return shadow(this, 'documentOutline', obj);
  }

  readDocumentOutline () {
    var xref = this.xref;
    var obj = this.catDict.get('Outlines');
    var root = { items: [] };
    if (isDict(obj)) {
      obj = obj.getRaw('First');
      var processed = new RefSet();
      if (isRef(obj)) {
        var queue = [{obj: obj, parent: root}];
        // to avoid recursion keeping track of the items
        // in the processed dictionary
        processed.put(obj);
        while (queue.length > 0) {
          var i = queue.shift();
          var outlineDict = xref.fetchIfRef(i.obj);
          if (outlineDict === null)
            continue;
          if (!outlineDict.has('Title'))
            throw new Error('Invalid outline item');
          var dest = outlineDict.get('A');
          if (dest)
            dest = dest.get('D');
          else if (outlineDict.has('Dest')) {
            dest = outlineDict.getRaw('Dest');
            if (isName(dest))
              dest = dest.name;
          }
          var title = outlineDict.get('Title');
          var outlineItem = {
            dest: dest,
            title: stringToPDFString(title),
            color: outlineDict.get('C') || [0, 0, 0],
            count: outlineDict.get('Count'),
            bold: !!(outlineDict.get('F') & 2),
            italic: !!(outlineDict.get('F') & 1),
            items: []
          };
          i.parent.items.push(outlineItem);
          obj = outlineDict.getRaw('First');
          if (isRef(obj) && !processed.has(obj)) {
            queue.push({obj: obj, parent: outlineItem});
            processed.put(obj);
          }
          obj = outlineDict.getRaw('Next');
          if (isRef(obj) && !processed.has(obj)) {
            queue.push({obj: obj, parent: i.parent});
            processed.put(obj);
          }
        }
      }
    }
    return root.items.length > 0 ? root.items : null;
  }

  get numPages() {
    var obj = this.toplevelPagesDict.get('Count');
    assert(
      isInt(obj),
      'page count in top level pages object is not an integer'
    );
    // shadow the prototype getter
    return shadow(this, 'num', obj);
  }

  cleanup () {
    this.fontCache.forEach(function (font) {
      delete font.sent;
      delete font.translated;
    });
    this.fontCache.clear();
  }

  getPage (pageIndex) {
    if (!(pageIndex in this.pagePromises)) {
      this.pagePromises[pageIndex] = this.getPageDict(pageIndex).then((a) => {
        const dict = a[0];
        const ref = a[1];

        return new Page(this.pdfManager, this.xref, pageIndex, dict, ref,
                        this.fontCache);
      });
    }

    return this.pagePromises[pageIndex];
  }

  /**
   * @param {number} pageIndex 
   */
  getPageDict (pageIndex) {
    return new Promise((resolve, reject) => {
      var nodesToVisit = [this.catDict.getRaw('Pages')];
      var currentPageIndex = 0;
      var xref = this.xref;
  
      async function next() {
        while (nodesToVisit.length) {
          var currentNode = nodesToVisit.pop();
  
          if (isRef(currentNode)) {
            const obj = await xref.fetchAsync(currentNode).catch(reject);

            if ((isDict(obj, 'Page') || (isDict(obj) && !obj.has('Kids')))) {
              if (pageIndex === currentPageIndex) {
                resolve([obj, currentNode]);
              } else {
                currentPageIndex++;
                next();
              }
              return;
            }
            nodesToVisit.push(obj);
            next();
            return;
          }
  
          // must be a child page dictionary
          assert(
            isDict(currentNode),
            'page dictionary kid reference points to wrong type of object'
          );
          const count = currentNode.get('Count');
          // Skip nodes where the page can't be.
          if (currentPageIndex + count <= pageIndex) {
            currentPageIndex += count;
            continue;
          }
  
          const kids = currentNode.get('Kids');
          assert(isArray(kids), 'page dictionary kids object is not an array');
          if (count === kids.length) {
            // Nodes that don't have the page have been skipped and this is the
            // bottom of the tree which means the page requested must be a
            // descendant of this pages node. Ideally we would just resolve the
            // promise with the page ref here, but there is the case where more
            // pages nodes could link to single a page (see issue 3666 pdf). To
            // handle this push it back on the queue so if it is a pages node it
            // will be descended into.
            nodesToVisit = [kids[pageIndex - currentPageIndex]];
            currentPageIndex = pageIndex;
            continue;
          } else {
            for (var last = kids.length - 1; last >= 0; last--) {
              nodesToVisit.push(kids[last]);
            }
          }
        }

        reject('Page index ' + pageIndex + ' not found.');
      }

      next();
    })
  }
}

export interface XRefEntry {
  offset: number,
  gen: number,
  free?: boolean,
  uncompressed?: boolean
}

export class XRef {
  public entries: Array<Dict | XRefEntry | null>;
  public startXRefQueue?: number[];
  public cache: Array<Dict | null>;
  public topDict?: Dict;
  public trailer?: Dict;
  public root?: XRef;
  
  constructor (public stream: Stream) {
    this.entries = [];
    this.cache = [];
  }

  setStartXRef (startXRef: number): void {
    // Store the starting positions of xref tables as we process them
    // so we can recover from missing data errors.
    this.startXRefQueue = [startXRef];
  }

  parse (recoveryMode: boolean): void {
    let trailerDict: Dict | undefined;
    
    if (!recoveryMode) {
      trailerDict = this.readXRef();
    }

    trailerDict?.assignXref(this);
    this.trailer = trailerDict;
    this.root = trailerDict?.get('Root')
  }

  public tableState?: {
    entryNum: number,
    streamPos: number,
    parserBuf1: number,
    parserBuf2: number,
    firstEntryNum?: number,
    entryCount?: number
  }

  processXRefTable (parser: Parser): Dict {
    if (!this.tableState) {
      // Stores state of the table as we process it so we can resume
      // from middle of table in case of missing data error.
      this.tableState = {
        entryNum: 0,
        streamPos: parser.lexer.stream.pos,
        parserBuf1: parser.buf1,
        parserBuf2: parser.buf2
      };
    }

    const obj = this.readXRefTable(parser);

    // Sanity check
    if (!isCmd(obj, 'trailer'))
      throw new Error('Invalid XRef table: could not find trailer dictionary');

    // Read trailer dictionary, e.g.
    // trailer
    //    << /Size 22
    //      /Root 20R
    //      /Info 10R
    //      /ID [ <81b14aafa313db63dbd6f981e49f94f4> ]
    //    >>
    // The parser goes through the entire stream << ... >> and provides
    // a getter interface for the key-value table
    const dict = parser.getObj();
    if (!isDict(dict))
      throw new Error('Invalid XRef table: could not parse trailer dictionary');

    delete this.tableState;
    return dict;
  }

  readXRefTable (parser: Parser) {
    // Example of cross-reference table:
    // xref
    // 0 1                    <-- subsection header (first obj #, obj count)
    // 0000000000 65535 f     <-- actual object (offset, generation #, f/n)
    // 23 2                   <-- subsection header ... and so on ...
    // 0000025518 00002 n
    // 0000025635 00000 n
    // trailer
    // ...

    const stream = parser.lexer.stream;
    const tableState = this.tableState!;
    stream.pos = tableState.streamPos;
    parser.buf1 = tableState.parserBuf1;
    parser.buf2 = tableState.parserBuf2;

    // Outer loop is over subsection headers
    let obj;
    let first: number | undefined;

    while (true) {
      if (!('firstEntryNum' in tableState) || !('entryCount' in tableState)) {
        if (isCmd(obj = parser.getObj(), 'trailer')) {
          break;
        }
        tableState.firstEntryNum = obj;
        tableState.entryCount = parser.getObj();
      }

      first = tableState.firstEntryNum;
      const count = tableState.entryCount;
      if (!isInt(first) || !isInt(count))
        throw new Error('Invalid XRef table: wrong types in subsection header');

      // Inner loop is over objects themselves
      for (let i = tableState.entryNum; i < count; i++) {
        tableState.streamPos = stream.pos;
        tableState.entryNum = i;
        tableState.parserBuf1 = parser.buf1;
        tableState.parserBuf2 = parser.buf2;

        const entry: XRefEntry = {
          offset: parser.getObj(),
          gen: parser.getObj()
        };

        const type = parser.getObj();

        if (isCmd(type, 'f'))
          entry.free = true;
        else if (isCmd(type, 'n'))
          entry.uncompressed = true;

        // Validate entry obj
        if (!isInt(entry.offset) || !isInt(entry.gen) || !(entry.free || entry.uncompressed)) {
          throw new Error('Invalid entry in XRef subsection: ' + first + ', ' + count);
        }

        if (!this.entries[i + first])
          this.entries[i + first] = entry;
      }

      tableState.entryNum = 0;
      tableState.streamPos = stream.pos;
      tableState.parserBuf1 = parser.buf1;
      tableState.parserBuf2 = parser.buf2;
      delete tableState.firstEntryNum;
      delete tableState.entryCount;
    }

    // Per issue 3248: hp scanners generate bad XRef
    if (first === 1 && this.entries[1] && (this.entries[1] as XRefEntry).free) {
      // shifting the entries
      this.entries.shift();
    }

    // Sanity check: as per spec, first object must be free
    if (this.entries[0] && !(this.entries[0] as XRefEntry).free)
      throw new Error('Invalid XRef table: unexpected first object');

    return obj;
  }

  readXRef (): Dict | undefined {
    const stream = this.stream;

    while (this.startXRefQueue?.length) {
      const startXRef = this.startXRefQueue[0];
      stream.pos = startXRef;

      const parser = new Parser(new Lexer(stream), true, null);
      const obj = parser.getObj();

      // Get dictionary
      if (isCmd(obj, 'xref')) {
        // Parse end-of-file XRef
        const dict = this.processXRefTable(parser);
        if (!this.topDict) {
          this.topDict = dict;
        }
      }
      else {
        throw new Error('Invalid XRef stream header');
      }

      this.startXRefQueue.shift();
    }

    return this.topDict;
  }

  getEntry (i: number): XRefEntry | null {
    const entry = this.entries[i] as (XRefEntry | null);

    if (entry === null)
      return null;

    // Return `null` if entry is free.
    return entry.free || !entry.offset ? null : entry;
  }

  fetchIfRef (obj: Dict): Dict | XRefEntry | number | null {
    if (!isRef(obj)) {
      return obj;
    }

    return this.fetch(obj);
  }

  fetch (ref: Ref): Dict | XRefEntry | number | null {
    if (!(ref instanceof Ref)) {
      throw new Error('ref object is not a reference');
    }
  
    let num = ref.num;
    let e: Dict | XRefEntry | null;

    if (num in this.cache) {
      e = this.cache[num] as Dict;
      return e;
    }

    e = this.getEntry(num);

    // the referenced entry can be free
    if (e === null)
      return (this.cache[num] = e);

    if (e.gen != ref.gen)
      throw new Error('inconsistent generation in XRef');

    const stream = this.stream.makeSubStream(e.offset);
    const parser = new Parser(new Lexer(stream), true, this);
    
    const obj1 = parser.getObj();
    const obj2 = parser.getObj();
    const obj3 = parser.getObj();

    if (!isInt(obj1) || obj1 != num ||
        !isInt(obj2) || obj2 != ref.gen ||
        !isCmd(obj3)) {
      throw new Error('bad XRef entry');
    }
    if (!isCmd(obj3, 'obj')) {
      // some bad pdfs use "obj1234" and really mean 1234
      if ((obj3 as Cmd).cmd.indexOf('obj') === 0) {
        num = parseInt((obj3 as Cmd).cmd.substring(3), 10);
        if (!isNaN(num))
          return num;
      }

      throw new Error('bad XRef entry');
    }
    
    e = parser.getObj() as Dict | Stream;
    
    if (!isStream(e)) {
      this.cache[num] = e;
    }

    return e;
  }

  async fetchIfRefAsync (obj) {
    if (!isRef(obj)) {
      return obj;
    }

    return this.fetchAsync(obj);
  }

  async fetchAsync (ref: Ref) {
    return this.fetch(ref)
  }

  getCatalogObj () {
    return this.root;
  }
}

/**
 * A NameTree is like a Dict but has some adventagous properties, see the spec
 * (7.9.6) for more details.
 */
export class NameTree {
  constructor (root, xref) {
    this.root = root;
    this.xref = xref;
  }
}

function mayHaveChildren(value) {
  return isRef(value) || isDict(value) || isArray(value) || isStream(value);
}

function addChildren(node: Dict | Stream, nodesToVisit: (Dict | undefined)[]) {
  if (isDict(node) || isStream(node)) {
    var map;
    if (isDict(node)) {
      map = node.map;
    }
    else {
      map = node.dict.map;
    }

    for (const key in map) {
      const value = map[key];
      if (mayHaveChildren(value)) {
        nodesToVisit.push(value);
      }
    }
  }
  else if (isArray(node)) {
    for (let i = 0, ii = node.length; i < ii; i++) {
      const value = node[i];
      if (mayHaveChildren(value)) {
        nodesToVisit.push(value);
      }
    }
  }
}

/**
 * A helper for loading missing data in object graphs. It traverses the graph
 * depth first and queues up any objects that have missing data. Once it has
 * has traversed as many objects that are available it attempts to bundle the
 * missing data requests and then resume from the nodes that weren't ready.
 *
 * NOTE: It provides protection from circular references by keeping track of
 * of loaded references. However, you must be careful not to load any graphs
 * that have references to the catalog or other pages since that will cause the
 * entire PDF document object graph to be traversed.
 */
export class ObjectLoader {
  obj;
  keys;
  xref;
  refSet: RefSet | null = null;

  constructor (obj, keys, xref) {
    this.obj = obj;
    this.keys = keys;
    this.xref = xref;
  }

  load () {
    var keys = this.keys;
    this.refSet = new RefSet();

    // Setup the initial nodes to visit.
    var nodesToVisit = [];

    for (let i = 0; i < keys.length; i++) {
      nodesToVisit.push(this.obj[keys[i]]);
    }

    this.walk(nodesToVisit);
  }

  walk (nodesToVisit: Array<Dict | undefined>) {
    // DFS walk of the object graph.
    while (nodesToVisit.length) {
      let currentNode = nodesToVisit.pop();

      // Only references or chunked streams can cause missing data exceptions.
      if (isRef(currentNode)) {
        // Skip nodes that have already been visited.
        if (this.refSet?.has(currentNode)) {
          continue;
        }

        const ref = currentNode;
        this.refSet?.put(ref);
        currentNode = this.xref.fetch(currentNode);
      }

      addChildren(currentNode!, nodesToVisit);
    }

    // Everything is loaded.
    this.refSet = null;
  }
}
