import { assert, bytesToString, isArray, isCmd, isDict, isInt, isName, isRef, isStream, shadow, stringToPDFString, stringToUTF8String } from "../shared/util";
import { Page } from "./core";
import { Lexer, Parser } from "./parser";
import { Stream } from "./stream";

export class Name {
  constructor (name) {
    this.name = name;
  }
}

export class Cmd {
  constructor (cmd) {
    this.cmd = cmd;
  }

  /** @private */
  static cmdCache = {};

  static get (cmd) {
    var cmdValue = Cmd.cmdCache[cmd];
    if (cmdValue)
      return cmdValue;

    return Cmd.cmdCache[cmd] = new Cmd(cmd);
  }
}

var nonSerializable = function nonSerializableClosure() {
  return nonSerializable; // creating closure on some variable
};

export class Dict {
  /**
   * 
   * @param {any} [xref] 
   */
  constructor (xref) {
    // Map should only be used internally, use functions below to access.
    this.map = Object.create(null);
    this.xref = xref;
    this.__nonSerializable__ = nonSerializable; // disable cloning of the Dict
  }

  assignXref (newXref) {
    this.xref = newXref;
  }

  // automatically dereferences Ref objects
  get (key1, key2, key3) {
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
  async getAsync (key1, key2, key3) {
    var value;
    var xref = this.xref;
    if (typeof (value = this.map[key1]) !== undefined || key1 in this.map ||
        typeof key2 === undefined) {
      if (xref) {
        return xref.fetchIfRefAsync(value);
      }
      return value;
    }
    if (typeof (value = this.map[key2]) !== undefined || key2 in this.map ||
        typeof key3 === undefined) {
      if (xref) {
        return xref.fetchIfRefAsync(value);
      }
      return value;
    }
    value = this.map[key3] || null;
    if (xref) {
      return xref.fetchIfRefAsync(value);
    }
    return value;
  }

  // no dereferencing
  getRaw (key) {
    return this.map[key];
  }

  // creates new map and dereferences all Refs
  getAll () {
    var all = {};
    for (var key in this.map) {
      var obj = this.get(key);
      all[key] = obj instanceof Dict ? obj.getAll() : obj;
    }
    return all;
  }

  set (key, value) {
    this.map[key] = value;
  }

  has (key) {
    return key in this.map;
  }

  forEach (callback) {
    for (var key in this.map) {
      callback(key, this.get(key));
    }
  }
}

export class Ref {
  num;
  gen;

  constructor (num, gen) {
    this.num = num;
    this.gen = gen;
  }
}

/**
 * The reference is identified by number and generation,
 * this structure stores only one instance of the reference.
 */
export class RefSet {
  /** @type {Record<string, boolean>} */
  dict = {};

  /**
   * @param {Ref} ref 
   * @returns {boolean}
   */
  has (ref) {
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
  constructor (pdfManager, xref) {
    this.pdfManager = pdfManager;
    this.xref = xref;
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

export class XRef {
  constructor (stream) {
    this.stream = stream;
    this.entries = [];
    this.xrefstms = {};
    // prepare the XRef cache
    this.cache = [];
  }

  setStartXRef (startXRef) {
    // Store the starting positions of xref tables as we process them
    // so we can recover from missing data errors
    this.startXRefQueue = [startXRef];
  }

  parse (recoveryMode) {
    let trailerDict;
    
    if (!recoveryMode) {
      trailerDict = this.readXRef();
    }

    trailerDict.assignXref(this);
    this.trailer = trailerDict;
    this.root = trailerDict.get('Root')
  }

  processXRefTable (parser) {
    if (!('tableState' in this)) {
      // Stores state of the table as we process it so we can resume
      // from middle of table in case of missing data error
      this.tableState = {
        entryNum: 0,
        streamPos: parser.lexer.stream.pos,
        parserBuf1: parser.buf1,
        parserBuf2: parser.buf2
      };
    }

    var obj = this.readXRefTable(parser);

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
    var dict = parser.getObj();
    if (!isDict(dict))
      throw new Error('Invalid XRef table: could not parse trailer dictionary');

    delete this.tableState;
    return dict;
  }

  readXRefTable (parser) {
    // Example of cross-reference table:
    // xref
    // 0 1                    <-- subsection header (first obj #, obj count)
    // 0000000000 65535 f     <-- actual object (offset, generation #, f/n)
    // 23 2                   <-- subsection header ... and so on ...
    // 0000025518 00002 n
    // 0000025635 00000 n
    // trailer
    // ...

    var stream = parser.lexer.stream;
    var tableState = this.tableState;
    stream.pos = tableState.streamPos;
    parser.buf1 = tableState.parserBuf1;
    parser.buf2 = tableState.parserBuf2;

    // Outer loop is over subsection headers
    var obj;

    while (true) {
      if (!('firstEntryNum' in tableState) || !('entryCount' in tableState)) {
        if (isCmd(obj = parser.getObj(), 'trailer')) {
          break;
        }
        tableState.firstEntryNum = obj;
        tableState.entryCount = parser.getObj();
      }

      var first = tableState.firstEntryNum;
      var count = tableState.entryCount;
      if (!isInt(first) || !isInt(count))
        throw new Error('Invalid XRef table: wrong types in subsection header');

      // Inner loop is over objects themselves
      for (var i = tableState.entryNum; i < count; i++) {
        tableState.streamPos = stream.pos;
        tableState.entryNum = i;
        tableState.parserBuf1 = parser.buf1;
        tableState.parserBuf2 = parser.buf2;

        var entry = {};
        entry.offset = parser.getObj();
        entry.gen = parser.getObj();
        var type = parser.getObj();

        if (isCmd(type, 'f'))
          entry.free = true;
        else if (isCmd(type, 'n'))
          entry.uncompressed = true;

        // Validate entry obj
        if (!isInt(entry.offset) || !isInt(entry.gen) ||
            !(entry.free || entry.uncompressed)) {
          console.log(entry.offset, entry.gen, entry.free,
              entry.uncompressed);
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
    if (first === 1 && this.entries[1] && this.entries[1].free) {
      // shifting the entries
      this.entries.shift();
    }

    // Sanity check: as per spec, first object must be free
    if (this.entries[0] && !this.entries[0].free)
      throw new Error('Invalid XRef table: unexpected first object');

    return obj;
  }

  processXRefStream (stream) {
    if (!('streamState' in this)) {
      // Stores state of the stream as we process it so we can resume
      // from middle of stream in case of missing data error
      var streamParameters = stream.dict;
      var byteWidths = streamParameters.get('W');
      var range = streamParameters.get('Index');
      if (!range) {
        range = [0, streamParameters.get('Size')];
      }

      this.streamState = {
        entryRanges: range,
        byteWidths: byteWidths,
        entryNum: 0,
        streamPos: stream.pos
      };
    }
    this.readXRefStream(stream);
    delete this.streamState;

    return stream.dict;
  }

  readXRefStream (stream) {
    var i, j;
    var streamState = this.streamState;
    stream.pos = streamState.streamPos;

    var byteWidths = streamState.byteWidths;
    var typeFieldWidth = byteWidths[0];
    var offsetFieldWidth = byteWidths[1];
    var generationFieldWidth = byteWidths[2];

    var entryRanges = streamState.entryRanges;
    while (entryRanges.length > 0) {

      var first = entryRanges[0];
      var n = entryRanges[1];

      if (!isInt(first) || !isInt(n))
        throw new Error('Invalid XRef range fields: ' + first + ', ' + n);

      if (!isInt(typeFieldWidth) || !isInt(offsetFieldWidth) ||
          !isInt(generationFieldWidth)) {
        throw new Error('Invalid XRef entry fields length: ' + first + ', ' + n);
      }
      for (i = streamState.entryNum; i < n; ++i) {
        streamState.entryNum = i;
        streamState.streamPos = stream.pos;

        var type = 0, offset = 0, generation = 0;
        for (j = 0; j < typeFieldWidth; ++j)
          type = (type << 8) | stream.getByte();
        // if type field is absent, its default value = 1
        if (typeFieldWidth === 0)
          type = 1;
        for (j = 0; j < offsetFieldWidth; ++j)
          offset = (offset << 8) | stream.getByte();
        for (j = 0; j < generationFieldWidth; ++j)
          generation = (generation << 8) | stream.getByte();
        var entry = {};
        entry.offset = offset;
        entry.gen = generation;
        switch (type) {
          case 0:
            entry.free = true;
            break;
          case 1:
            entry.uncompressed = true;
            break;
          case 2:
            break;
          default:
            throw new Error('Invalid XRef entry type: ' + type);
        }
        if (!this.entries[first + i])
          this.entries[first + i] = entry;
      }

      streamState.entryNum = 0;
      streamState.streamPos = stream.pos;
      entryRanges.splice(0, 2);
    }
  }

  readXRef () {
    var stream = this.stream;

    while (this.startXRefQueue?.length) {
      var startXRef = this.startXRefQueue[0];

      stream.pos = startXRef;

      var parser = new Parser(new Lexer(stream), true, null);
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

  /**
   * 
   * @param {number} i 
   * @returns 
   */
  getEntry (i) {
    var e = this.entries[i];
    if (e === null)
      return null;
    return e.free || !e.offset ? null : e; // returns null if entry is free
  }

  fetchIfRef (obj) {
    if (!isRef(obj)) {
      return obj;
    }

    return this.fetch(obj);
  }

  fetch (ref) {
    assert(isRef(ref), 'ref object is not a reference');
  
    let num = ref.num;
    let e;
    
    if (num in this.cache) {
      e = this.cache[num];

      if (e instanceof Stream) {
        return e.makeSubStream(e.start, e.length, e.dict);
      }
      return e;
    }

    e = this.getEntry(num);

    // the referenced entry can be free
    if (e === null)
      return (this.cache[num] = e);

    var gen = ref.gen;
    let stream, parser;

    if (e.uncompressed) {
      if (e.gen != gen)
        throw new Error('inconsistent generation in XRef');
      stream = this.stream.makeSubStream(e.offset);
      parser = new Parser(new Lexer(stream), true, this);
      var obj1 = parser.getObj();
      var obj2 = parser.getObj();
      var obj3 = parser.getObj();
      if (!isInt(obj1) || obj1 != num ||
          !isInt(obj2) || obj2 != gen ||
          !isCmd(obj3)) {
        throw new Error('bad XRef entry');
      }
      if (!isCmd(obj3, 'obj')) {
        // some bad pdfs use "obj1234" and really mean 1234
        if (obj3.cmd.indexOf('obj') === 0) {
          num = parseInt(obj3.cmd.substring(3), 10);
          if (!isNaN(num))
            return num;
        }
        throw new Error('bad XRef entry');
      }
      
      e = parser.getObj();
      
      if (!isStream(e)) {
        this.cache[num] = e;
      }

      return e;
    }

    // compressed entry
    const tableOffset = e.offset;
    stream = this.fetch(new Ref(tableOffset, 0));

    if (!isStream(stream)) {
      throw new Error('bad ObjStm stream');
    }
    const first = stream.dict.get('First');
    const n = stream.dict.get('N');

    if (!isInt(first) || !isInt(n)) {
      throw new Error('invalid first and n parameters for ObjStm stream');
    }

    parser = new Parser(new Lexer(stream), false, this);
    parser.allowStreams = true;

    const entries = [];
    const nums = [];

    // read the object numbers to populate cache
    for (let i = 0; i < n; ++i) {
      const num = parser.getObj();
      if (!isInt(num)) {
        throw new Error('invalid object number in the ObjStm stream: ' + num);
      }
      nums.push(num);
      
      const offset = parser.getObj();
      if (!isInt(offset)) {
        throw new Error('invalid object offset in the ObjStm stream: ' + offset);
      }
    }
    // read stream objects for cache
    for (let i = 0; i < n; ++i) {
      entries.push(parser.getObj());
      const num = nums[i];
      var entry = this.entries[num];
      if (entry && entry.offset === tableOffset && entry.gen === i) {
        this.cache[num] = entries[i];
      }
    }

    e = entries[e.gen];
    if (e === undefined) {
      throw new Error('bad XRef entry for compressed object');
    }

    return e;
  }

  async fetchIfRefAsync (obj) {
    if (!isRef(obj)) {
      return obj;
    }

    return this.fetchAsync(obj);
  }

  async fetchAsync (ref) {
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

/**
 * @param {Dict | FlateStream} node 
 * @param {Array<Dict | undefined>} nodesToVisit 
 */
function addChildren(node, nodesToVisit) {
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
  /** @type {RefSet | null} */
  refSet = null;

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

  /**
   * @param {Array<Dict | undefined>} nodesToVisit 
   * @returns 
   */
  walk (nodesToVisit) {
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

      addChildren(currentNode, nodesToVisit);
    }

    // Everything is loaded.
    this.refSet = null;
  }
}
