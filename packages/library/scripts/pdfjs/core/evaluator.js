// @ts-check
'use strict';

class PartialEvaluator {
  constructor (pdfManager, xref, handler, pageIndex, uniquePrefix, idCounters, fontCache) {
    this.state = new EvalState();
    this.stateStack = [];

    this.pdfManager = pdfManager;
    this.xref = xref;
    this.handler = handler;
    this.pageIndex = pageIndex;
    this.uniquePrefix = uniquePrefix;
    this.idCounters = idCounters;
    this.fontCache = fontCache;
  }

  // Specifies properties for each command
  //
  // If variableArgs === true: [0, `numArgs`] expected
  // If variableArgs === false: exactly `numArgs` expected
  static OP_MAP = {
    // Graphic state
    w: { id: OPS.setLineWidth, numArgs: 1, variableArgs: false },
    J: { id: OPS.setLineCap, numArgs: 1, variableArgs: false },
    j: { id: OPS.setLineJoin, numArgs: 1, variableArgs: false },
    M: { id: OPS.setMiterLimit, numArgs: 1, variableArgs: false },
    d: { id: OPS.setDash, numArgs: 2, variableArgs: false },
    ri: { id: OPS.setRenderingIntent, numArgs: 1, variableArgs: false },
    i: { id: OPS.setFlatness, numArgs: 1, variableArgs: false },
    gs: { id: OPS.setGState, numArgs: 1, variableArgs: false },
    q: { id: OPS.save, numArgs: 0, variableArgs: false },
    Q: { id: OPS.restore, numArgs: 0, variableArgs: false },
    cm: { id: OPS.transform, numArgs: 6, variableArgs: false },

    // Path
    m: { id: OPS.moveTo, numArgs: 2, variableArgs: false },
    l: { id: OPS.lineTo, numArgs: 2, variableArgs: false },
    c: { id: OPS.curveTo, numArgs: 6, variableArgs: false },
    v: { id: OPS.curveTo2, numArgs: 4, variableArgs: false },
    y: { id: OPS.curveTo3, numArgs: 4, variableArgs: false },
    h: { id: OPS.closePath, numArgs: 0, variableArgs: false },
    re: { id: OPS.rectangle, numArgs: 4, variableArgs: false },
    S: { id: OPS.stroke, numArgs: 0, variableArgs: false },
    s: { id: OPS.closeStroke, numArgs: 0, variableArgs: false },
    f: { id: OPS.fill, numArgs: 0, variableArgs: false },
    F: { id: OPS.fill, numArgs: 0, variableArgs: false },
    'f*': { id: OPS.eoFill, numArgs: 0, variableArgs: false },
    B: { id: OPS.fillStroke, numArgs: 0, variableArgs: false },
    'B*': { id: OPS.eoFillStroke, numArgs: 0, variableArgs: false },
    b: { id: OPS.closeFillStroke, numArgs: 0, variableArgs: false },
    'b*': { id: OPS.closeEOFillStroke, numArgs: 0, variableArgs: false },
    n: { id: OPS.endPath, numArgs: 0, variableArgs: false },

    // Clipping
    W: { id: OPS.clip, numArgs: 0, variableArgs: false },
    'W*': { id: OPS.eoClip, numArgs: 0, variableArgs: false },

    // Text
    BT: { id: OPS.beginText, numArgs: 0, variableArgs: false },
    ET: { id: OPS.endText, numArgs: 0, variableArgs: false },
    Tc: { id: OPS.setCharSpacing, numArgs: 1, variableArgs: false },
    Tw: { id: OPS.setWordSpacing, numArgs: 1, variableArgs: false },
    Tz: { id: OPS.setHScale, numArgs: 1, variableArgs: false },
    TL: { id: OPS.setLeading, numArgs: 1, variableArgs: false },
    Tf: { id: OPS.setFont, numArgs: 2, variableArgs: false },
    Tr: { id: OPS.setTextRenderingMode, numArgs: 1, variableArgs: false },
    Ts: { id: OPS.setTextRise, numArgs: 1, variableArgs: false },
    Td: { id: OPS.moveText, numArgs: 2, variableArgs: false },
    TD: { id: OPS.setLeadingMoveText, numArgs: 2, variableArgs: false },
    Tm: { id: OPS.setTextMatrix, numArgs: 6, variableArgs: false },
    'T*': { id: OPS.nextLine, numArgs: 0, variableArgs: false },
    Tj: { id: OPS.showText, numArgs: 1, variableArgs: false },
    TJ: { id: OPS.showSpacedText, numArgs: 1, variableArgs: false },
    '\'': { id: OPS.nextLineShowText, numArgs: 1, variableArgs: false },
    '"': { id: OPS.nextLineSetSpacingShowText, numArgs: 3,
      variableArgs: false },

    // Color
    CS: { id: OPS.setStrokeColorSpace, numArgs: 1, variableArgs: false },
    cs: { id: OPS.setFillColorSpace, numArgs: 1, variableArgs: false },
    SC: { id: OPS.setStrokeColor, numArgs: 4, variableArgs: true },
    SCN: { id: OPS.setStrokeColorN, numArgs: 33, variableArgs: true },
    sc: { id: OPS.setFillColor, numArgs: 4, variableArgs: true },
    scn: { id: OPS.setFillColorN, numArgs: 33, variableArgs: true },
    G: { id: OPS.setStrokeGray, numArgs: 1, variableArgs: false },
    RG: { id: OPS.setStrokeRGBColor, numArgs: 3, variableArgs: false },
    rg: { id: OPS.setFillRGBColor, numArgs: 3, variableArgs: false },

    // XObjects
    Do: { id: OPS.paintXObject, numArgs: 1, variableArgs: false },
    MP: { id: OPS.markPoint, numArgs: 1, variableArgs: false },
    DP: { id: OPS.markPointProps, numArgs: 2, variableArgs: false },
    BMC: { id: OPS.beginMarkedContent, numArgs: 1, variableArgs: false },
    BDC: { id: OPS.beginMarkedContentProps, numArgs: 2,
      variableArgs: false },
    EMC: { id: OPS.endMarkedContent, numArgs: 0, variableArgs: false },

    // (reserved partial commands for the lexer)
    BM: null,
    BD: null,
    'true': null,
    fa: null,
    fal: null,
    fals: null,
    'false': null,
    nu: null,
    nul: null,
    'null': null
  };

  static SHADING_PATTERN = 2;

  buildFormXObject (resources, xobj, operatorList) {
    const matrix = xobj.dict.get('Matrix');
    const bbox = xobj.dict.get('BBox');

    operatorList.addOp(OPS.paintFormXObjectBegin, [matrix, bbox]);
    this.getOperatorList(xobj, xobj.dict.get('Resources') || resources, operatorList);
    operatorList.addOp(OPS.paintFormXObjectEnd, []);
  }

  /**
   * @param {*} resources 
   * @param {Array<any> | null} fontArgs 
   * @param {*} fontRef 
   * @returns 
   */
  handleSetFont (resources, fontArgs, fontRef) {
    let fontName;
    if (fontArgs) {
      fontArgs = fontArgs.slice();
      fontName = fontArgs[0].name;
    }

    const font = this.loadFont(fontName, fontRef, this.xref, resources);
    this.state.font = font;
    const loadedName = font.loadedName;

    if (!font.sent) {
      const fontData = font.translated.exportData();

      this.handler.commonobj([
        loadedName,
        'Font',
        fontData
      ]);

      font.sent = true;
    }

    return loadedName;
  }

  /**
   * @param {string} chars 
   * @returns {Array<any>} array of glyphs
   */
  handleText (chars) {
    const font = this.state.font.translated;
    return font.charsToGlyphs(chars);
  }

  loadFont (fontName, font, xref, resources) {
    let fontRef;

    if (font) { // Loading by ref.
      assert(isRef(font));
      fontRef = font;
    }
    else { // Loading by name.
      const fontRes = resources.get('Font');
      if (fontRes) {
        fontRef = fontRes.getRaw(fontName);
      }
    }

    if (this.fontCache.has(fontRef)) {
      return this.fontCache.get(fontRef);
    }

    font = xref.fetchIfRef(fontRef);
    this.fontCache.put(fontRef, font);

    // keep track of each font we translated so the caller can
    // load them asynchronously before calling display on a page
    font.loadedName = 'g_font_' + fontRef.num + '_' + fontRef.gen;

    if (!font.translated) {
      const translated = this.translateFont(font);
      font.translated = translated;
    }

    font.loaded = true;
    return font;
  }

  getOperatorList (stream, resources, operatorList) {
    const xref = this.xref;
    
    operatorList = operatorList || new OperatorList();
    resources = resources || new Dict();

    const xobjs = resources.get('XObject') || new Dict();
    const parser = new Parser(new Lexer(stream, PartialEvaluator.OP_MAP), false, xref);

    let args = [];
    while (true) {
      const obj = parser.getObj();
      if (isEOF(obj)) break;

      if (isCmd(obj)) {
        const cmd = obj.cmd;

        // Check that the command is valid
        var opSpec = PartialEvaluator.OP_MAP[cmd];
        if (!opSpec) {
          console.warn('Unknown command "' + cmd + '"');
          continue;
        }

        var fn = opSpec.id;

        // Validate the number of arguments for the command
        if (!opSpec.variableArgs) {
          if (args.length < opSpec.numArgs) {
            args = [];
            continue;
          }
        }

        switch (fn) {
          case OPS.paintXObject: {
            if (args[0].code) {
              break;
            }

            const name = args[0].name;
            const xobj = xobjs.get(name);

            if (xobj) {
              assert(isStream(xobj), 'XObject should be a stream');

              const type = xobj.dict.get('Subtype');
              assert(isName(type), 'XObject should have a Name subtype');

              if ('Form' == type.name) {
                this.buildFormXObject(resources, xobj, operatorList);
                args = [];
                continue;
              }
              else {
                throw new Error('unhandled xobject subtype ' + type.name);
              }
            }

            break;
          }

          case OPS.setFont: {
            const loadedName = this.handleSetFont(resources, args, null);
            operatorList.addDependency(loadedName);
            args[0] = loadedName;
            break;
          }

          case OPS.save: {
            const old = this.state;
            this.stateStack.push(this.state);
            this.state = old.clone();
            break;
          }

          case OPS.restore: {
            const prev = this.stateStack.pop();
            
            if (prev) {
              this.state = prev;
            }

            break;
          }

          case OPS.showText: {
            args[0] = this.handleText(args[0]);
            break;
          }
        }

        operatorList.addOp(fn, args);

        args = [];
        parser.saveState();
      }
      else if (obj !== null && obj !== undefined) {
        args.push(obj instanceof Dict ? obj.getAll() : obj);
        assert(args.length <= 33, 'Too many arguments');
      }
    }

    return operatorList;
  }

  translateFont (dict) {
    const MAX_CHAR_INDEX = 0xFF;

    const type = dict.get('Subtype');
    assert(isName(type), 'invalid font: Subtype');

    const properties = {
      type: type.name,
      firstChar: 0,
      lastChar: MAX_CHAR_INDEX
    };

    if (dict.get('FontDescriptor')) {
      const firstChar = dict.get('FirstChar');
      if (firstChar) properties.firstChar = firstChar;
      
      const lastChar = dict.get('LastChar');
      if (lastChar) properties.lastChar = lastChar;
    }

    return new Font(properties);
  }
}

class OperatorList {
  static CHUNK_SIZE = 100;

  /**
   * 
   * @param {*} [messageHandler] 
   * @param {number} [pageIndex] 
   */
  constructor (messageHandler, pageIndex) {
    this.messageHandler = messageHandler;
    this.fnArray = new Uint8Array(OperatorList.CHUNK_SIZE);
    this.argsArray = [];
    this.dependencies = {},
    this.pageIndex = pageIndex;
    this.fnIndex = 0;
  }

  get length () {
    return this.argsArray.length;
  }

  /**
   * @param {number} fn - probably from OPS 
   * @param {Array<unknown>} args 
   */
  addOp (fn, args) {
    this.fnArray[this.fnIndex++] = fn;
    this.argsArray.push(args);
    if (this.fnIndex >= OperatorList.CHUNK_SIZE) {
      this.flush();
    }
  }

  addDependency (dependency) {
    if (dependency in this.dependencies) return;
    this.dependencies[dependency] = true;
    this.addOp(OPS.dependency, [dependency]);
  }

  addDependencies (dependencies) {
    for (const key in dependencies) {
      this.addDependency(key);
    }
  }

  getIR () {
    return {
      fnArray: this.fnArray,
      argsArray: this.argsArray,
      length: this.length
    };
  }

  /**
   * @param {boolean} [lastChunk]
   * @returns {void} 
   */
  flush (lastChunk) {
    this.messageHandler.RenderPageChunk({
      operatorList: {
        fnArray: this.fnArray,
        argsArray: this.argsArray,
        lastChunk: lastChunk,
        length: this.length
      },
      pageIndex: this.pageIndex
    })

    this.dependencies = [];
    this.argsArray = [];
    this.fnIndex = 0;
  }
}

class EvalState {
  /**
   * @public
   * @type {Font | null}
   */
  font;

  /**
   * @public
   * @type {number}
   */
  textRenderingMode;

  constructor () {
    this.font = null;
    this.textRenderingMode = TextRenderingMode.FILL;
  }
  
  clone () {
    return Object.create(this);
  }
}
