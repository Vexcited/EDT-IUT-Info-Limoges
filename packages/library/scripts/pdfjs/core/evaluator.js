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

    // Type3 fonts
    d0: { id: OPS.setCharWidth, numArgs: 2, variableArgs: false },
    d1: { id: OPS.setCharWidthAndBounds, numArgs: 6, variableArgs: false },

    // Color
    CS: { id: OPS.setStrokeColorSpace, numArgs: 1, variableArgs: false },
    cs: { id: OPS.setFillColorSpace, numArgs: 1, variableArgs: false },
    SC: { id: OPS.setStrokeColor, numArgs: 4, variableArgs: true },
    SCN: { id: OPS.setStrokeColorN, numArgs: 33, variableArgs: true },
    sc: { id: OPS.setFillColor, numArgs: 4, variableArgs: true },
    scn: { id: OPS.setFillColorN, numArgs: 33, variableArgs: true },
    G: { id: OPS.setStrokeGray, numArgs: 1, variableArgs: false },
    g: { id: OPS.setFillGray, numArgs: 1, variableArgs: false },
    RG: { id: OPS.setStrokeRGBColor, numArgs: 3, variableArgs: false },
    rg: { id: OPS.setFillRGBColor, numArgs: 3, variableArgs: false },
    K: { id: OPS.setStrokeCMYKColor, numArgs: 4, variableArgs: false },
    k: { id: OPS.setFillCMYKColor, numArgs: 4, variableArgs: false },

    // Shading
    sh: { id: OPS.shadingFill, numArgs: 1, variableArgs: false },

    // Images
    BI: { id: OPS.beginInlineImage, numArgs: 0, variableArgs: false },
    ID: { id: OPS.beginImageData, numArgs: 0, variableArgs: false },
    EI: { id: OPS.endInlineImage, numArgs: 1, variableArgs: false },

    // XObjects
    Do: { id: OPS.paintXObject, numArgs: 1, variableArgs: false },
    MP: { id: OPS.markPoint, numArgs: 1, variableArgs: false },
    DP: { id: OPS.markPointProps, numArgs: 2, variableArgs: false },
    BMC: { id: OPS.beginMarkedContent, numArgs: 1, variableArgs: false },
    BDC: { id: OPS.beginMarkedContentProps, numArgs: 2,
      variableArgs: false },
    EMC: { id: OPS.endMarkedContent, numArgs: 0, variableArgs: false },

    // Compatibility
    BX: { id: OPS.beginCompat, numArgs: 0, variableArgs: false },
    EX: { id: OPS.endCompat, numArgs: 0, variableArgs: false },

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

      this.handler.send('commonobj', [
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

  /**
   * 
   * @param {string} fontName 
   * @param {*} font 
   * @param {*} xref 
   * @param {*} resources 
   * @returns 
   */
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
      const translated = this.translateFont(font, xref);
      font.translated = translated;
    }

    font.loaded = true;
    return font;
  }

  getOperatorList (stream, resources, operatorList) {
    var xref = this.xref;

    operatorList = operatorList || new OperatorList();

    resources = resources || new Dict();
    var xobjs = resources.get('XObject') || new Dict();
    var patterns = resources.get('Pattern') || new Dict();
    const parser = new Parser(new Lexer(stream, PartialEvaluator.OP_MAP), false, xref);

    let args = [];
    while (true) {
      var obj = parser.getObj();

      if (isEOF(obj)) {
        break;
      }

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
        if (opSpec.variableArgs) {
          if (args.length > opSpec.numArgs) {
            console.info('Command ' + fn + ': expected [0,' + opSpec.numArgs +
                '] args, but received ' + args.length + ' args');
          }
        } else {
          if (args.length < opSpec.numArgs) {
            // If we receive too few args, it's not possible to possible
            // to execute the command, so skip the command
            console.info('Command ' + fn + ': because expected ' +
                  opSpec.numArgs + ' args, but received ' + args.length +
                  ' args; skipping');
            args = [];
            continue;
          } else if (args.length > opSpec.numArgs) {
            console.info('Command ' + fn + ': expected ' + opSpec.numArgs +
                ' args, but received ' + args.length + ' args');
          }
        }

        // TODO figure out how to type-check vararg functions

        switch (fn) {
          case OPS.setStrokeColorN:
          case OPS.setFillColorN:
            if (args[args.length - 1].code) {
              break;
            }
            // compile tiling patterns
            var patternName = args[args.length - 1];
            // SCN/scn applies patterns along with normal colors
            var pattern;
            if (isName(patternName) &&
                (pattern = patterns.get(patternName.name))) {

              var dict = isStream(pattern) ? pattern.dict : pattern;
              var typeNum = dict.get('PatternType');

              if (typeNum == PartialEvaluator.SHADING_PATTERN) {
                var shading = dict.get('Shading');
                var matrix = dict.get('Matrix');
                var pattern = Pattern.parseShading(shading, matrix, xref,
                                                    resources);
                args = pattern.getIR();
              } else {
                throw new Error('Unkown PatternType ' + typeNum);
              }
            }
            break;
          case OPS.paintXObject:
            if (args[0].code) {
              break;
            }
            // eagerly compile XForm objects
            var name = args[0].name;
            var xobj = xobjs.get(name);
            if (xobj) {
              assertWellFormed(
                  isStream(xobj), 'XObject should be a stream');

              var type = xobj.dict.get('Subtype');
              assertWellFormed(
                isName(type),
                'XObject should have a Name subtype'
              );

              if ('Form' == type.name) {
                this.buildFormXObject(resources, xobj, operatorList);
                args = [];
                continue;
              } else {
                throw new Error('Unhandled XObject subtype ' + type.name);
              }
            }
            break;
          case OPS.setFont:
            // eagerly collect all fonts
            var loadedName = this.handleSetFont(resources, args, null);
            operatorList.addDependency(loadedName);
            args[0] = loadedName;
            break;
          case OPS.save:
            var old = this.state;
            this.stateStack.push(this.state);
            this.state = old.clone();
            break;
          case OPS.restore:
            var prev = this.stateStack.pop();
            if (prev) {
              this.state = prev;
            }
            break;
          case OPS.showText:
            args[0] = this.handleText(args[0]);
            break;
          case OPS.showSpacedText:
            var arr = args[0];
            var arrLength = arr.length;
            for (var i = 0; i < arrLength; ++i) {
              if (isString(arr[i])) {
                arr[i] = this.handleText(arr[i]);
              }
            }
            break;
          case OPS.nextLineShowText:
            args[0] = this.handleText(args[0]);
            break;
          case OPS.nextLineSetSpacingShowText:
            args[2] = this.handleText(args[2]);
            break;
          case OPS.setTextRenderingMode:
            this.state.textRenderingMode = args[0];
            break;
          // Parse the ColorSpace data to a raw format.
          case OPS.setFillColorSpace:
          case OPS.setStrokeColorSpace:
            args = [ColorSpace.parseToIR(args[0], xref, resources)];
            break;
          case OPS.shadingFill:
            var shadingRes = resources.get('Shading');
            if (!shadingRes)
              throw new Error('No shading resource found');

            var shading = shadingRes.get(args[0].name);
            if (!shading)
              throw new Error('No shading object found');

            var shadingFill = Pattern.parseShading(
                shading, null, xref, resources);
            var patternIR = shadingFill.getIR();
            args = [patternIR];
            fn = OPS.shadingFill;
            break;
        } // switch

        operatorList.addOp(fn, args);
        args = [];
        parser.saveState();
      } else if (obj !== null && obj !== undefined) {
        args.push(obj instanceof Dict ? obj.getAll() : obj);
        assertWellFormed(args.length <= 33, 'Too many arguments');
      }
    }

    return operatorList;
  }

  extractDataStructures (properties) {
    properties.differences = [];
    properties.baseEncoding = Encodings.StandardEncoding;
    properties.hasEncoding = false;
    properties.overridableEncoding = true;
  }

  extractWidths (properties) {
    properties.defaultWidth = 0;
    properties.widths = [];
    properties.vmetrics = [];
  }

  translateFont (dict, xref) {
    var baseDict = dict;
    var type = dict.get('Subtype');
    assert(isName(type), 'invalid font Subtype');

    var composite = false;
    if (type.name == 'Type0') {
      // If font is a composite
      //  - get the descendant font
      //  - set the type according to the descendant font
      //  - get the FontDescriptor from the descendant font
      var df = dict.get('DescendantFonts');
      if (!df)
        throw new Error('Descendant fonts are not specified');

      dict = isArray(df) ? xref.fetchIfRef(df[0]) : df;

      type = dict.get('Subtype');
      assert(isName(type), 'invalid font Subtype');
      composite = true;
    }
    var maxCharIndex = composite ? 0xFFFF : 0xFF;

    const descriptor = dict.get('FontDescriptor');
    if (!descriptor) {
      // Before PDF 1.5 if the font was one of the base 14 fonts, having a
      // FontDescriptor was not required.
      // This case is here for compatibility.
      let baseFontName = dict.get('BaseFont');
      if (!isName(baseFontName)) {
        throw new Error('base font is not specified');
      }

      // Using base font name as a font name.
      baseFontName = baseFontName.name.replace(/[,_]/g, '-');

      const properties = {
        type: type.name,
        widths: [],
        defaultWidth: {},
        flags: 0,
        firstChar: 0,
        lastChar: maxCharIndex
      };

      this.extractDataStructures(properties);
      return new Font(baseFontName, null, properties);
    }

    // According to the spec if 'FontDescriptor' is declared, 'FirstChar',
    // 'LastChar' and 'Widths' should exist too, but some PDF encoders seem
    // to ignore this rule when a variant of a standart font is used.
    // TODO Fill the width array depending on which of the base font this is
    // a variant.
    const firstChar = dict.get('FirstChar') || 0;
    const lastChar = dict.get('LastChar') || maxCharIndex;

    let fontName = descriptor.get('FontName');
    let baseFont = dict.get('BaseFont');

    // Some bad pdf's have a string as the font name.
    if (isString(fontName)) {
      fontName = new Name(fontName);
    }
    if (isString(baseFont)) {
      baseFont = new Name(baseFont);
    }

    if (type.name !== 'Type3') {
      var fontNameStr = fontName && fontName.name;
      var baseFontStr = baseFont && baseFont.name;
      if (fontNameStr !== baseFontStr) {
        console.info('The FontDescriptor\'s FontName is "' + fontNameStr +
              '" but should be the same as the Font\'s BaseFont "' +
              baseFontStr + '"');
      }
    }

    fontName = fontName || baseFont;
    assertWellFormed(isName(fontName), 'invalid font name');

    const fontFile = descriptor.get('FontFile', 'FontFile2', 'FontFile3');
    let length1, length2, subtype;

    if (fontFile) {
      if (fontFile.dict) {
        subtype = fontFile.dict.get('Subtype');
        if (subtype)
          subtype = subtype.name;

        length1 = fontFile.dict.get('Length1');
        length2 = fontFile.dict.get('Length2');
      }
    }

    const properties = {
      type: type.name,
      subtype: subtype,
      file: fontFile,
      length1: length1,
      length2: length2,
      loadedName: baseDict.loadedName,
      composite: composite,
      wideChars: composite,
      fixedPitch: false,
      fontMatrix: dict.get('FontMatrix') || FONT_IDENTITY_MATRIX,
      firstChar: firstChar || 0,
      lastChar: lastChar || maxCharIndex,
      bbox: descriptor.get('FontBBox'),
      ascent: descriptor.get('Ascent'),
      descent: descriptor.get('Descent'),
      xHeight: descriptor.get('XHeight'),
      capHeight: descriptor.get('CapHeight'),
      flags: descriptor.get('Flags'),
      italicAngle: descriptor.get('ItalicAngle'),
      coded: false
    };

    this.extractWidths(properties);
    this.extractDataStructures(properties);

    return new Font(fontName.name, fontFile, properties);
  }
}

class OperatorList {
  static CHUNK_SIZE = 100;

  constructor (messageHandler, pageIndex) {
    this.messageHandler = messageHandler;
    // When there isn't a message handler the fn array needs to be able to grow
    // since we can't flush the operators.
    if (messageHandler) {
      this.fnArray = new Uint8Array(OperatorList.CHUNK_SIZE);
    } else {
      this.fnArray = [];
    }
    this.argsArray = [];
    this.dependencies = {},
    this.pageIndex = pageIndex;
    this.fnIndex = 0;
  }

  get length() {
    return this.argsArray.length;
  }

  addOp (fn, args) {
    if (this.messageHandler) {
      this.fnArray[this.fnIndex++] = fn;
      this.argsArray.push(args);
      if (this.fnIndex >= OperatorList.CHUNK_SIZE) {
        this.flush();
      }
    }
    else {
      this.fnArray.push(fn);
      this.argsArray.push(args);
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
    this.messageHandler.send('RenderPageChunk', {
      operatorList: {
        fnArray: this.fnArray,
        argsArray: this.argsArray,
        lastChunk: lastChunk,
        length: this.length
      },
      pageIndex: this.pageIndex
    });

    this.dependencies = [];
    this.fnIndex = 0;
    this.argsArray = [];
  }
}

class TextState {
  constructor () {
    this.fontSize = 0;
    this.ctm = [1, 0, 0, 1, 0, 0];
    this.textMatrix = [1, 0, 0, 1, 0, 0];
    this.stateStack = [];

    // textState variables
    this.leading = 0;
    this.textHScale = 1;
    this.textRise = 0;
  }

  push () {
    this.stateStack.push(this.ctm.slice());
  }

  pop () {
    var prev = this.stateStack.pop();
    if (prev) {
      this.ctm = prev;
    }
  }

  initialiseTextObj () {
    const m = this.textMatrix;

    m[0] = 1,
    m[1] = 0,
    m[2] = 0,
    m[3] = 1,
    m[4] = 0,
    m[5] = 0;
  }

  /**
   * @param {number} a 
   * @param {number} b 
   * @param {number} c 
   * @param {number} d 
   * @param {number} e 
   * @param {number} f 
   */
  setTextMatrix (a, b, c, d, e, f) {
    const m = this.textMatrix;

    m[0] = a,
    m[1] = b,
    m[2] = c,
    m[3] = d,
    m[4] = e,
    m[5] = f;
  }

  /**
   * @param {number} a 
   * @param {number} b 
   * @param {number} c 
   * @param {number} d 
   * @param {number} e 
   * @param {number} f 
   */
  transformCTM (a, b, c, d, e, f) {
    const m = this.ctm;
    const m0 = m[0],
          m1 = m[1],
          m2 = m[2],
          m3 = m[3],
          m4 = m[4],
          m5 = m[5];

    m[0] = m0 * a + m2 * b;
    m[1] = m1 * a + m3 * b;
    m[2] = m0 * c + m2 * d;
    m[3] = m1 * c + m3 * d;
    m[4] = m0 * e + m2 * f + m4;
    m[5] = m1 * e + m3 * f + m5;
  }

  /**
   * @param {number} x 
   * @param {number} y 
   */
  translateTextMatrix (x, y) {
    const m = this.textMatrix;
    
    m[4] = m[0] * x + m[2] * y + m[4];
    m[5] = m[1] * x + m[3] * y + m[5];
  }

  calcRenderParams () {
    const tm = this.textMatrix;
    const cm = this.ctm;

    const a = this.fontSize;
    const b = a * this.textHScale;
    const c = this.textRise;

    const vScale = Math.sqrt((tm[2] * tm[2]) + (tm[3] * tm[3]));
    const angle = Math.atan2(tm[1], tm[0]);

    const m0 = tm[0] * cm[0] + tm[1] * cm[2];
    const m1 = tm[0] * cm[1] + tm[1] * cm[3];
    const m2 = tm[2] * cm[0] + tm[3] * cm[2];
    const m3 = tm[2] * cm[1] + tm[3] * cm[3];
    const m4 = tm[4] * cm[0] + tm[5] * cm[2] + cm[4];
    const m5 = tm[4] * cm[1] + tm[5] * cm[3] + cm[5];

    const renderMatrix = [
      b * m0,
      b * m1,
      a * m2,
      a * m3,
      c * m2 + m4,
      c * m3 + m5
    ];

    return {
      renderMatrix,
      vScale,
      angle
    };
  }
}

class EvalState {
  constructor () {
    this.font = null;
    this.textRenderingMode = TextRenderingMode.FILL;
  }
  
  clone () {
    return Object.create(this);
  }
}

