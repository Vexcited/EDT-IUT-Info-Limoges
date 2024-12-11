// <canvas> contexts store most of the state we need natively.
// However, PDF needs a bit more state, which we store here.

import { ColorSpace } from "../shared/colorspace";
import { FONT_IDENTITY_MATRIX, IDENTITY_MATRIX, isArray, isNum, NO_OPS, NO_OPS_RANGE, OPS, TextRenderingMode, Util } from "../shared/util";

// Minimal font size that would be used during canvas fillText operations.
var MIN_FONT_SIZE = 16;

// @ts-expect-error
export function addContextCurrentTransform(ctx) {
  // If the context doesn't expose a `mozCurrentTransform`, add a JS based on.
  if (!ctx.mozCurrentTransform) {
    // Store the original context
    ctx._scaleX = ctx._scaleX || 1.0;
    ctx._scaleY = ctx._scaleY || 1.0;
    ctx._originalSave = ctx.save;
    ctx._originalRestore = ctx.restore;
    ctx._originalRotate = ctx.rotate;
    ctx._originalScale = ctx.scale;
    ctx._originalTranslate = ctx.translate;
    ctx._originalTransform = ctx.transform;
    ctx._originalSetTransform = ctx.setTransform;

    ctx._transformMatrix = [ctx._scaleX, 0, 0, ctx._scaleY, 0, 0];
    ctx._transformStack = [];

    Object.defineProperty(ctx, 'mozCurrentTransform', {
      get: function getCurrentTransform() {
        return this._transformMatrix;
      }
    });

    Object.defineProperty(ctx, 'mozCurrentTransformInverse', {
      get: function getCurrentTransformInverse() {
        // Calculation done using WolframAlpha:
        // http://www.wolframalpha.com/input/?
        //   i=Inverse+{{a%2C+c%2C+e}%2C+{b%2C+d%2C+f}%2C+{0%2C+0%2C+1}}

        var m = this._transformMatrix;
        var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];

        var ad_bc = a * d - b * c;
        var bc_ad = b * c - a * d;

        return [
          d / ad_bc,
          b / bc_ad,
          c / bc_ad,
          a / ad_bc,
          (d * e - c * f) / bc_ad,
          (b * e - a * f) / ad_bc
        ];
      }
    });

    ctx.save = function ctxSave() {
      var old = this._transformMatrix;
      this._transformStack.push(old);
      this._transformMatrix = old.slice(0, 6);

      this._originalSave();
    };

    ctx.restore = function ctxRestore() {
      var prev = this._transformStack.pop();
      if (prev) {
        this._transformMatrix = prev;
        this._originalRestore();
      }
    };

    // @ts-expect-error
    ctx.translate = function ctxTranslate(x, y) {
      var m = this._transformMatrix;
      m[4] = m[0] * x + m[2] * y + m[4];
      m[5] = m[1] * x + m[3] * y + m[5];

      this._originalTranslate(x, y);
    };

    // @ts-expect-error
    ctx.scale = function ctxScale(x, y) {
      var m = this._transformMatrix;
      m[0] = m[0] * x;
      m[1] = m[1] * x;
      m[2] = m[2] * y;
      m[3] = m[3] * y;

      this._originalScale(x, y);
    };

    // @ts-expect-error
    ctx.transform = function ctxTransform(a, b, c, d, e, f) {
      var m = this._transformMatrix;
      this._transformMatrix = [
        m[0] * a + m[2] * b,
        m[1] * a + m[3] * b,
        m[0] * c + m[2] * d,
        m[1] * c + m[3] * d,
        m[0] * e + m[2] * f + m[4],
        m[1] * e + m[3] * f + m[5]
      ];

      ctx._originalTransform(a, b, c, d, e, f);
    };

    // @ts-expect-error
    ctx.setTransform = function ctxSetTransform(a, b, c, d, e, f) {
      this._transformMatrix = [a, b, c, d, e, f];

      ctx._originalSetTransform(a, b, c, d, e, f);
    };

    // @ts-expect-error
    ctx.rotate = function ctxRotate(angle) {
      var cosValue = Math.cos(angle);
      var sinValue = Math.sin(angle);

      var m = this._transformMatrix;
      this._transformMatrix = [
        m[0] * cosValue + m[2] * sinValue,
        m[1] * cosValue + m[3] * sinValue,
        m[0] * (-sinValue) + m[2] * cosValue,
        m[1] * (-sinValue) + m[3] * cosValue,
        m[4],
        m[5]
      ];

      this._originalRotate(angle);
    };
  }
}

export var CachedCanvases = (function CachedCanvasesClosure() {
  var cache = {};
  return {
    // @ts-expect-error
    getCanvas (id, width, height, trackTransform) {
      var canvasEntry;
      if (id in cache) {
        // @ts-expect-error
        canvasEntry = cache[id];
        canvasEntry.canvas.width = width;
        canvasEntry.canvas.height = height;
        // reset canvas transform for emulated mozCurrentTransform, if needed
        canvasEntry.context.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        // @ts-expect-error
        var canvas = createScratchCanvas(width, height);
        var ctx = canvas.getContext('2d');
        if (trackTransform) {
          addContextCurrentTransform(ctx);
        }
        // @ts-expect-error
        cache[id] = canvasEntry = {canvas: canvas, context: ctx};
      }
      return canvasEntry;
    },
    clear: function () {
      cache = {};
    }
  };
})();

export var CanvasExtraState = (function CanvasExtraStateClosure() {
  // @ts-expect-error
  function CanvasExtraState(old) {
    // Are soft masks and alpha values shapes or opacities?
    // @ts-expect-error
    this.alphaIsShape = false;
    // @ts-expect-error
    this.fontSize = 0;
    // @ts-expect-error
    this.fontSizeScale = 1;
    // @ts-expect-error
    this.textMatrix = IDENTITY_MATRIX;
    // @ts-expect-error
    this.fontMatrix = FONT_IDENTITY_MATRIX;
    // @ts-expect-error
    this.leading = 0;
    // Current point (in user coordinates)
    // @ts-expect-error
    this.x = 0;
    // @ts-expect-error
    this.y = 0;
    // Start of text line (in text coordinates)
    // @ts-expect-error
    this.lineX = 0;
    // @ts-expect-error
    this.lineY = 0;
    // Character and word spacing
    // @ts-expect-error
    this.charSpacing = 0;
    // @ts-expect-error
    this.wordSpacing = 0;
    // @ts-expect-error
    this.textHScale = 1;
    // @ts-expect-error
    this.textRenderingMode = TextRenderingMode.FILL;
    // @ts-expect-error
    this.textRise = 0;
    // Color spaces
    // @ts-expect-error
    this.fillColorSpace = ColorSpace.singletons.gray;
    // @ts-expect-error
    this.fillColorSpaceObj = null;
    // @ts-expect-error
    this.strokeColorSpace = ColorSpace.singletons.gray;
    // @ts-expect-error
    this.strokeColorSpaceObj = null;
    // @ts-expect-error
    this.fillColorObj = null;
    // @ts-expect-error
    this.strokeColorObj = null;
    // Default fore and background colors
    // @ts-expect-error
    this.fillColor = '#000000';
    // @ts-expect-error
    this.strokeColor = '#000000';
    // Note: fill alpha applies to all non-stroking operations
    // @ts-expect-error
    this.fillAlpha = 1;
    // @ts-expect-error
    this.strokeAlpha = 1;
    // @ts-expect-error
    this.lineWidth = 1;
    // @ts-expect-error
    this.paintFormXObjectDepth = 0;

    // @ts-expect-error
    this.old = old;
  }

  CanvasExtraState.prototype = {
    clone: function CanvasExtraState_clone() {
      return Object.create(this);
    },
    // @ts-expect-error
    setCurrentPoint: function CanvasExtraState_setCurrentPoint(x, y) {
      this.x = x;
      this.y = y;
    }
  };
  return CanvasExtraState;
})();

export var CanvasGraphics = (function CanvasGraphicsClosure() {
  // Defines the time the executeOperatorList is going to be executing
  // before it stops and shedules a continue of execution.
  var EXECUTION_TIME = 15;

  /**
   * 
   * @param {*} canvasCtx 
   * @param {PDFObjects} commonObjs 
   * @param {PDFObjects} objs 
   * @param {*} textLayer 
   * @param {*} imageLayer 
   */
  // @ts-expect-error
  function CanvasGraphics(canvasCtx, commonObjs, objs, textLayer, imageLayer) {
    // @ts-expect-error
    this.ctx = canvasCtx;
    // @ts-expect-error
    this.current = new CanvasExtraState();
    // @ts-expect-error
    this.stateStack = [];
    // @ts-expect-error
    this.pendingClip = null;
    // @ts-expect-error
    this.pendingEOFill = false;
    // @ts-expect-error
    this.res = null;
    // @ts-expect-error
    this.xobjs = null;
    // @ts-expect-error
    this.commonObjs = commonObjs;
    // @ts-expect-error
    this.objs = objs;
    // @ts-expect-error
    this.textLayer = textLayer;
    // @ts-expect-error
    this.imageLayer = imageLayer;
    // @ts-expect-error
    this.groupStack = [];
    // @ts-expect-error
    this.processingType3 = null;
    // Patterns are painted relative to the initial page/form transform, see pdf
    // spec 8.7.2 NOTE 1.
    // @ts-expect-error
    this.baseTransform = null;
    // @ts-expect-error
    this.baseTransformStack = [];
    // @ts-expect-error
    this.groupLevel = 0;

    //MQZ.Mar.22 Disabled Operators
    // @ts-expect-error
    this.opMode = true;
    // @ts-expect-error
    this.noOpStartIdx = -1;

    if (canvasCtx) {
      addContextCurrentTransform(canvasCtx);
    }
  }

  var LINE_CAP_STYLES = ['butt', 'round', 'square'];
  var LINE_JOIN_STYLES = ['miter', 'round', 'bevel'];
  var NORMAL_CLIP = {};
  var EO_CLIP = {};

  CanvasGraphics.prototype = {
    // @ts-expect-error
    beginDrawing: function CanvasGraphics_beginDrawing(viewport, transparency) {
      // For pdfs that use blend modes we have to clear the canvas else certain
      // blend modes can look wrong since we'd be blending with a white
      // backdrop. The problem with a transparent backdrop though is we then
      // don't get sub pixel anti aliasing on text, so we fill with white if
      // we can.
      var width = this.ctx.canvas.width;
      var height = this.ctx.canvas.height;
      if (transparency) {
        this.ctx.clearRect(0, 0, width, height);
      } else {
        this.ctx.mozOpaque = true;
        this.ctx.save();
        this.ctx.fillStyle = 'rgb(255, 255, 255)';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.restore();
      }

      var transform = viewport.transform;
      this.baseTransform = transform.slice();
      this.ctx.save();
      this.ctx.transform.apply(this.ctx, transform);

      if (this.textLayer) {
        this.textLayer.beginLayout();
      }
      if (this.imageLayer) {
        this.imageLayer.beginLayout();
      }
    },

    // @ts-expect-error
    executeOperatorList (operatorList, executionStartIdx) {
      var argsArray = operatorList.argsArray;
      var fnArray = operatorList.fnArray;
      var i = executionStartIdx || 0;
      var argsArrayLen = argsArray.length;

      // Sometimes the OperatorList to execute is empty.
      if (argsArrayLen == i) {
        return i;
      }

      var executionEndIdx;
      var endTime = Date.now() + EXECUTION_TIME;

      var commonObjs = this.commonObjs;
      var objs = this.objs;
      var fnId;

//MQZ.Mar.22 Disabled Operators
      var noOpIdx = -1;

      while (true) {
        fnId = fnArray[i];

        if (fnId !== OPS.dependency) {
          noOpIdx = NO_OPS_RANGE.indexOf(fnId);
          if (this.opMode) {
             if (noOpIdx >= 0) {
               this.opMode = false;
               this.noOpStartIdx = noOpIdx;
               console.info("NO_OP Begin: " + this[fnId].name + " - " + i);
             }
             else if (NO_OPS.indexOf(fnId) < 0) {
               this[fnId].apply(this, argsArray[i]);
             }
          }
          else {
             if (noOpIdx >= 0 && noOpIdx === (this.noOpStartIdx+1)) {
               this.opMode = true;
               this.noOpStartIdx = -1;
               console.info("NO_OP End: " + this[fnId].name + " - " + i);
             }
          }
        }

        i++;

        // If the entire operatorList was executed, stop as were done.
        if (i == argsArrayLen) {
          return i;
        }
      }
    },

    endDrawing: function CanvasGraphics_endDrawing() {
      this.ctx.restore();
      CachedCanvases.clear();

      if (this.textLayer) {
        this.textLayer.endLayout();
      }
      if (this.imageLayer) {
        this.imageLayer.endLayout();
      }
    },

    // Graphics state
    // @ts-expect-error
    setLineWidth: function CanvasGraphics_setLineWidth(width) {
      this.current.lineWidth = width;
      this.ctx.lineWidth = width;
    },
    // @ts-expect-error
    setLineCap: function CanvasGraphics_setLineCap(style) {
      this.ctx.lineCap = LINE_CAP_STYLES[style];
    },
    // @ts-expect-error
    setLineJoin: function CanvasGraphics_setLineJoin(style) {
      this.ctx.lineJoin = LINE_JOIN_STYLES[style];
    },
    // @ts-expect-error
    setMiterLimit: function CanvasGraphics_setMiterLimit(limit) {
      this.ctx.miterLimit = limit;
    },
    // @ts-expect-error
    setDash: function CanvasGraphics_setDash(dashArray, dashPhase) {
      var ctx = this.ctx;
      if ('setLineDash' in ctx) {
        ctx.setLineDash(dashArray);
        ctx.lineDashOffset = dashPhase;
      } else {
        ctx.mozDash = dashArray;
        ctx.mozDashOffset = dashPhase;
      }
    },
    // @ts-expect-error
    setRenderingIntent: function CanvasGraphics_setRenderingIntent(intent) {
      // Maybe if we one day fully support color spaces this will be important
      // for now we can ignore.
      // TODO set rendering intent?
    },
    // @ts-expect-error
    setFlatness: function CanvasGraphics_setFlatness(flatness) {
      // There's no way to control this with canvas, but we can safely ignore.
      // TODO set flatness?
    },
    // @ts-expect-error
    setGState: function CanvasGraphics_setGState(states) {
      for (var i = 0, ii = states.length; i < ii; i++) {
        var state = states[i];
        var key = state[0];
        var value = state[1];

        switch (key) {
          case 'LW':
            this.setLineWidth(value);
            break;
          case 'LC':
            this.setLineCap(value);
            break;
          case 'LJ':
            this.setLineJoin(value);
            break;
          case 'ML':
            this.setMiterLimit(value);
            break;
          case 'D':
            this.setDash(value[0], value[1]);
            break;
          case 'RI':
            this.setRenderingIntent(value);
            break;
          case 'FL':
            this.setFlatness(value);
            break;
          case 'Font':
            this.setFont(value[0], value[1]);
            break;
          case 'CA':
            this.current.strokeAlpha = state[1];
            break;
          case 'ca':
            this.current.fillAlpha = state[1];
            this.ctx.globalAlpha = state[1];
            break;
          case 'BM':
            if (value && value.name && (value.name !== 'Normal')) {
              var mode = value.name.replace(/([A-Z])/g,
                // @ts-expect-error
                function(c) {
                  return '-' + c.toLowerCase();
                }
              ).substring(1);
              this.ctx.globalCompositeOperation = mode;
              if (this.ctx.globalCompositeOperation !== mode) {
                console.warn('globalCompositeOperation "' + mode +
                     '" is not supported');
              }
            } else {
              this.ctx.globalCompositeOperation = 'source-over';
            }
            break;
        }
      }
    },
    save: function CanvasGraphics_save() {
      this.ctx.save();
      var old = this.current;
      this.stateStack.push(old);
      this.current = old.clone();
    },
    restore: function CanvasGraphics_restore() {
      var prev = this.stateStack.pop();
      if (prev) {
        this.current = prev;
        this.ctx.restore();
      }
    },
    // @ts-expect-error
    transform: function CanvasGraphics_transform(a, b, c, d, e, f) {
      this.ctx.transform(a, b, c, d, e, f);
    },

    // Path
    // @ts-expect-error
    moveTo: function CanvasGraphics_moveTo(x, y) {
      this.ctx.moveTo(x, y);
      this.current.setCurrentPoint(x, y);
    },
    // @ts-expect-error
    lineTo: function CanvasGraphics_lineTo(x, y) {
      this.ctx.lineTo(x, y);
      this.current.setCurrentPoint(x, y);
    },
    // @ts-expect-error
    curveTo: function CanvasGraphics_curveTo(x1, y1, x2, y2, x3, y3) {
      this.ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      this.current.setCurrentPoint(x3, y3);
    },
    // @ts-expect-error
    curveTo2: function CanvasGraphics_curveTo2(x2, y2, x3, y3) {
      var current = this.current;
      this.ctx.bezierCurveTo(current.x, current.y, x2, y2, x3, y3);
      current.setCurrentPoint(x3, y3);
    },
    // @ts-expect-error
    curveTo3: function CanvasGraphics_curveTo3(x1, y1, x3, y3) {
      this.curveTo(x1, y1, x3, y3, x3, y3);
      this.current.setCurrentPoint(x3, y3);
    },
    closePath: function CanvasGraphics_closePath() {
      this.ctx.closePath();
    },
    // @ts-expect-error
    rectangle: function CanvasGraphics_rectangle(x, y, width, height) {
      this.ctx.rect(x, y, width, height);
    },
    // @ts-expect-error
    stroke: function CanvasGraphics_stroke(consumePath) {
      consumePath = typeof consumePath !== 'undefined' ? consumePath : true;
      var ctx = this.ctx;
      var strokeColor = this.current.strokeColor;
      if (this.current.lineWidth === 0)
        ctx.lineWidth = this.getSinglePixelWidth();
      // For stroke we want to temporarily change the global alpha to the
      // stroking alpha.
      ctx.globalAlpha = this.current.strokeAlpha;
      if (strokeColor && strokeColor.hasOwnProperty('type') &&
          strokeColor.type === 'Pattern') {
        // for patterns, we transform to pattern space, calculate
        // the pattern, call stroke, and restore to user space
        ctx.save();
        ctx.strokeStyle = strokeColor.getPattern(ctx, this);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }
      if (consumePath)
        this.consumePath();
      // Restore the global alpha to the fill alpha
      ctx.globalAlpha = this.current.fillAlpha;
    },
    closeStroke: function CanvasGraphics_closeStroke() {
      this.closePath();
      this.stroke();
    },
    // @ts-expect-error
    fill: function CanvasGraphics_fill(consumePath) {
      consumePath = typeof consumePath !== 'undefined' ? consumePath : true;
      var ctx = this.ctx;
      var fillColor = this.current.fillColor;
      var needRestore = false;

      if (fillColor && fillColor.hasOwnProperty('type') &&
          fillColor.type === 'Pattern') {
        ctx.save();
        ctx.fillStyle = fillColor.getPattern(ctx, this);
        needRestore = true;
      }

      if (this.pendingEOFill) {
        if ('mozFillRule' in this.ctx) {
          this.ctx.mozFillRule = 'evenodd';
          this.ctx.fill();
          this.ctx.mozFillRule = 'nonzero';
        } else {
          try {
            this.ctx.fill('evenodd');
          } catch (ex) {
            // shouldn't really happen, but browsers might think differently
            this.ctx.fill();
          }
        }
        this.pendingEOFill = false;
      } else {
        this.ctx.fill();
      }

      if (needRestore) {
        ctx.restore();
      }
      if (consumePath) {
        this.consumePath();
      }
    },
    eoFill: function CanvasGraphics_eoFill() {
      this.pendingEOFill = true;
      this.fill();
    },
    fillStroke: function CanvasGraphics_fillStroke() {
      this.fill(false);
      this.stroke(false);

      this.consumePath();
    },
    eoFillStroke: function CanvasGraphics_eoFillStroke() {
      this.pendingEOFill = true;
      this.fillStroke();
    },
    closeFillStroke: function CanvasGraphics_closeFillStroke() {
      this.closePath();
      this.fillStroke();
    },
    closeEOFillStroke: function CanvasGraphics_closeEOFillStroke() {
      this.pendingEOFill = true;
      this.closePath();
      this.fillStroke();
    },
    endPath: function CanvasGraphics_endPath() {
      this.consumePath();
    },

    // Clipping
    clip: function CanvasGraphics_clip() {
      this.pendingClip = NORMAL_CLIP;
    },
    eoClip: function CanvasGraphics_eoClip() {
      this.pendingClip = EO_CLIP;
    },

    // Text
    beginText: function CanvasGraphics_beginText() {
      this.current.textMatrix = IDENTITY_MATRIX;
      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    },
    endText: function CanvasGraphics_endText() {
      if (!('pendingTextPaths' in this)) {
        this.ctx.beginPath();
        return;
      }
      var paths = this.pendingTextPaths;
      var ctx = this.ctx;

      ctx.save();
      ctx.beginPath();
      for (var i = 0; i < paths.length; i++) {
        var path = paths[i];
        ctx.setTransform.apply(ctx, path.transform);
        ctx.translate(path.x, path.y);
        path.addToPath(ctx, path.fontSize);
      }
      ctx.restore();
      ctx.clip();
      ctx.beginPath();
      delete this.pendingTextPaths;
    },
    // @ts-expect-error
    setCharSpacing: function CanvasGraphics_setCharSpacing(spacing) {
      this.current.charSpacing = spacing;
    },
    // @ts-expect-error
    setWordSpacing: function CanvasGraphics_setWordSpacing(spacing) {
      this.current.wordSpacing = spacing;
    },
    // @ts-expect-error
    setHScale: function CanvasGraphics_setHScale(scale) {
      this.current.textHScale = scale / 100;
    },
    // @ts-expect-error
    setLeading: function CanvasGraphics_setLeading(leading) {
      this.current.leading = -leading;
    },
    // @ts-expect-error
    setFont: function CanvasGraphics_setFont(fontRefName, size) {
      var fontObj = this.commonObjs.get(fontRefName);
      var current = this.current;

      if (!fontObj)
        throw new Error('Can\'t find font for ' + fontRefName);

      current.fontMatrix = fontObj.fontMatrix ? fontObj.fontMatrix :
                                                FONT_IDENTITY_MATRIX;

      // A valid matrix needs all main diagonal elements to be non-zero
      // This also ensures we bypass FF bugzilla bug #719844.
      if (current.fontMatrix[0] === 0 ||
          current.fontMatrix[3] === 0) {
        console.warn('Invalid font matrix for font ' + fontRefName);
      }

      // The spec for Tf (setFont) says that 'size' specifies the font 'scale',
      // and in some docs this can be negative (inverted x-y axes).
      if (size < 0) {
        size = -size;
        current.fontDirection = -1;
      } else {
        current.fontDirection = 1;
      }

      this.current.font = fontObj;
      this.current.fontSize = size;

      if (fontObj.coded)
        return; // we don't need ctx.font for Type3 fonts

      var name = fontObj.loadedName || 'sans-serif';
      var bold = fontObj.black ? (fontObj.bold ? 'bolder' : 'bold') :
                                 (fontObj.bold ? 'bold' : 'normal');

      var italic = fontObj.italic ? 'italic' : 'normal';
      var typeface = '"' + name + '", ' + fontObj.fallbackName;

      // Some font backends cannot handle fonts below certain size.
      // Keeping the font at minimal size and using the fontSizeScale to change
      // the current transformation matrix before the fillText/strokeText.
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=726227
      var browserFontSize = size >= MIN_FONT_SIZE ? size : MIN_FONT_SIZE;
      this.current.fontSizeScale = browserFontSize != MIN_FONT_SIZE ? 1.0 :
                                   size / MIN_FONT_SIZE;

      var rule = italic + ' ' + bold + ' ' + browserFontSize + 'px ' + typeface;
      this.ctx.font = rule;

      this.ctx.setFont(fontObj);
    },
    // @ts-expect-error
    setTextRenderingMode: function CanvasGraphics_setTextRenderingMode(mode) {
      this.current.textRenderingMode = mode;
    },
    // @ts-expect-error
    setTextRise: function CanvasGraphics_setTextRise(rise) {
      this.current.textRise = rise;
    },
    // @ts-expect-error
    moveText: function CanvasGraphics_moveText(x, y) {
      this.current.x = this.current.lineX += x;
      this.current.y = this.current.lineY += y;
    },
    // @ts-expect-error
    setLeadingMoveText: function CanvasGraphics_setLeadingMoveText(x, y) {
      this.setLeading(-y);
      this.moveText(x, y);
    },
    // @ts-expect-error
    setTextMatrix: function CanvasGraphics_setTextMatrix(a, b, c, d, e, f) {
      this.current.textMatrix = [a, b, c, d, e, f];

      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    },
    nextLine: function CanvasGraphics_nextLine() {
      this.moveText(0, this.current.leading);
    },
    applyTextTransforms: function CanvasGraphics_applyTextTransforms() {
      var ctx = this.ctx;
      var current = this.current;
      ctx.transform.apply(ctx, current.textMatrix);
      ctx.translate(current.x, current.y + current.textRise);
      if (current.fontDirection > 0) {
        ctx.scale(current.textHScale, -1);
      } else {
        ctx.scale(-current.textHScale, 1);
      }
    },
    createTextGeometry: function CanvasGraphics_createTextGeometry() {
      var geometry = {};
      var ctx = this.ctx;
      var font = this.current.font;
      var ctxMatrix = ctx.mozCurrentTransform;
      var a = ctxMatrix[0], b = ctxMatrix[1], c = ctxMatrix[2];
      var d = ctxMatrix[3], e = ctxMatrix[4], f = ctxMatrix[5];
      var sx = (a >= 0) ?
          Math.sqrt((a * a) + (b * b)) : -Math.sqrt((a * a) + (b * b));
      var sy = (d >= 0) ?
          Math.sqrt((c * c) + (d * d)) : -Math.sqrt((c * c) + (d * d));
      var angle = Math.atan2(b, a);
      var x = e;
      var y = f;
      // @ts-expect-error
      geometry.x = x;
      // @ts-expect-error
      geometry.y = y;
      // @ts-expect-error
      geometry.hScale = sx;
      // @ts-expect-error
      geometry.vScale = sy;
      // @ts-expect-error
      geometry.angle = angle;
      // @ts-expect-error
      geometry.spaceWidth = font.spaceWidth;
      // @ts-expect-error
      geometry.fontName = font.loadedName;
      // @ts-expect-error
      geometry.fontFamily = font.fallbackName;
      // @ts-expect-error
      geometry.fontSize = this.current.fontSize;
      return geometry;
    },

    // @ts-expect-error
    paintChar: function (character, x, y) {
      var ctx = this.ctx;
      var current = this.current;
      var font = current.font;
      var fontSize = current.fontSize / current.fontSizeScale;
      var textRenderingMode = current.textRenderingMode;
      var fillStrokeMode = textRenderingMode &
        TextRenderingMode.FILL_STROKE_MASK;
      var isAddToPathSet = !!(textRenderingMode &
        TextRenderingMode.ADD_TO_PATH_FLAG);

      var addToPath;
      if (isAddToPathSet) {
        addToPath = font.getPathGenerator(this.commonObjs, character);
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      addToPath(ctx, fontSize);
      if (fillStrokeMode === TextRenderingMode.FILL ||
          fillStrokeMode === TextRenderingMode.FILL_STROKE) {
        ctx.fill();
      }
      if (fillStrokeMode === TextRenderingMode.STROKE ||
          fillStrokeMode === TextRenderingMode.FILL_STROKE) {
        ctx.stroke();
      }
      ctx.restore();

      if (isAddToPathSet) {
        var paths = this.pendingTextPaths || (this.pendingTextPaths = []);
        paths.push({
          transform: ctx.mozCurrentTransform,
          x: x,
          y: y,
          fontSize: fontSize,
          addToPath: addToPath
        });
      }
    },

    // @ts-expect-error
    showText: function CanvasGraphics_showText(glyphs, skipTextSelection) {
      var ctx = this.ctx;
      var current = this.current;
      var font = current.font || {};
      var fontSize = current.fontSize;
      var fontSizeScale = current.fontSizeScale;
      var charSpacing = current.charSpacing;
      var wordSpacing = current.wordSpacing;
      var textHScale = current.textHScale * current.fontDirection;
      var fontMatrix = current.fontMatrix || FONT_IDENTITY_MATRIX;
      var glyphsLength = glyphs.length;
      var textLayer = this.textLayer;
      var geom;
      var textSelection = textLayer && !skipTextSelection ? true : false;
      var canvasWidth = 0.0;
      var vertical = font.vertical;
      var defaultVMetrics = font.defaultVMetrics;

      // Type3 fonts - each glyph is a "mini-PDF"
      if (font.coded) {
        ctx.save();
        ctx.transform.apply(ctx, current.textMatrix);
        ctx.translate(current.x, current.y);

        ctx.scale(textHScale, 1);

        if (textSelection) {
          this.save();
          ctx.scale(1, -1);
          geom = this.createTextGeometry();
          this.restore();
        }
        for (var i = 0; i < glyphsLength; ++i) {

          var glyph = glyphs[i];
          if (glyph === null) {
            // word break
            this.ctx.translate(wordSpacing, 0);
            current.x += wordSpacing * textHScale;
            continue;
          }

          this.processingType3 = glyph;
          this.save();
          ctx.scale(fontSize, fontSize);
          ctx.transform.apply(ctx, fontMatrix);
          this.executeOperatorList(glyph.operatorList);
          this.restore();

          var transformed = Util.applyTransform([glyph.width, 0], fontMatrix);
          var width = (transformed[0] * fontSize + charSpacing) *
                      current.fontDirection;

          ctx.translate(width, 0);
          current.x += width * textHScale;

          canvasWidth += width;
        }
        ctx.restore();
        this.processingType3 = null;
      } else {
        ctx.save();

//MQZ Dec.04.2013 handles leading word spacing
          var tx = 0;
          if (wordSpacing !== 0) {
            // @ts-expect-error
            var firstGlyph = glyphs.filter(g => g && ('fontChar' in g || 'unicode' in g))[0];
            if (firstGlyph && (firstGlyph.fontChar === ' ' || firstGlyph.unicode === ' ')) {
              tx = wordSpacing * fontSize * textHScale;
            }
          }

        current.x += tx
        this.applyTextTransforms();
        current.x -= tx
        // MQZ-GYJ Apr.20.2017 handles leading word spacing over

        var lineWidth = current.lineWidth;
        var a1 = current.textMatrix[0], b1 = current.textMatrix[1];
        var scale = Math.sqrt(a1 * a1 + b1 * b1);
        if (scale === 0 || lineWidth === 0)
          lineWidth = this.getSinglePixelWidth();
        else
          lineWidth /= scale;

        if (textSelection)
          geom = this.createTextGeometry();

        if (fontSizeScale != 1.0) {
          ctx.scale(fontSizeScale, fontSizeScale);
          lineWidth /= fontSizeScale;
        }

        ctx.lineWidth = lineWidth;

//MQZ. Feb.20.2013. Disable character based painting, make it a string
          var str = "";

        var x = 0;
        for (var i = 0; i < glyphsLength; ++i) {
          var glyph = glyphs[i];
          if (glyph === null) {
            // word break
            x += current.fontDirection * wordSpacing;
            continue;
          }

          var restoreNeeded = false;
          var character = glyph.fontChar;
          var vmetric = glyph.vmetric || defaultVMetrics;
          if (vertical) {
            var vx = glyph.vmetric ? vmetric[1] : glyph.width * 0.5;
            vx = -vx * fontSize * current.fontMatrix[0];
            var vy = vmetric[2] * fontSize * current.fontMatrix[0];
          }
          // @ts-expect-error
          var width = vmetric ? -vmetric[0] : glyph.width;
          var charWidth = width * fontSize * current.fontMatrix[0] +
                          charSpacing * current.fontDirection;
          var accent = glyph.accent;

          var scaledX, scaledY, scaledAccentX, scaledAccentY;
          if (!glyph.disabled) {
            if (vertical) {
              scaledX = vx / fontSizeScale;
              // @ts-expect-error
              scaledY = (x + vy) / fontSizeScale;
            } else {
              scaledX = x / fontSizeScale;
              scaledY = 0;
            }

            if (font.remeasure && width > 0) {
              // some standard fonts may not have the exact width, trying to
              // rescale per character
              var measuredWidth = ctx.measureText(character).width * 1000 /
                current.fontSize * current.fontSizeScale;

              var characterScaleX = width / measuredWidth;
              restoreNeeded = true;
              ctx.save();
              ctx.scale(characterScaleX, 1);
              scaledX /= characterScaleX;
              if (accent) {
                // @ts-expect-error
                scaledAccentX /= characterScaleX;
              }
            }

            //MQZ. Feb.20.2013. Disable character based painting, make it a string
//            this.paintChar(character, scaledX, scaledY);
              str += glyph.unicode || character;
            if (accent) {
              scaledAccentX = scaledX + accent.offset.x / fontSizeScale;
              scaledAccentY = scaledY - accent.offset.y / fontSizeScale;
                //MQZ. Feb.20.2013. Disable character based painting, make it a string
//              this.paintChar(accent.fontChar, scaledAccentX, scaledAccentY);
//                str += accent.fontChar;
            }
          }

          x += charWidth;

          canvasWidth += charWidth;

          if (restoreNeeded) {
            ctx.restore();
          }
        }
        if (vertical) {
          current.y -= x * textHScale;
        } else {
          current.x += x * textHScale;
        }
        
        if (str) {
            var curFontSize = fontSize * scale * textHScale + 3;
            switch (current.textRenderingMode) {
              case TextRenderingMode.FILL:
                  ctx.fillText(str, 0, 0, canvasWidth, curFontSize);
                  break;
              case TextRenderingMode.STROKE:
                  ctx.strokeText(str, 0, 0, canvasWidth, curFontSize);
                  break;
              case TextRenderingMode.FILL_STROKE:
                  ctx.fillText(str, 0, 0, canvasWidth, curFontSize);
                  break;
              case TextRenderingMode.INVISIBLE:
              case TextRenderingMode.ADD_TO_PATH:
                  break;
              default: // other unsupported rendering modes
          }
        }

        ctx.restore();
      }

      if (textSelection) {
        geom.canvasWidth = canvasWidth;
        if (vertical) {
          var VERTICAL_TEXT_ROTATION = Math.PI / 2;
          geom.angle += VERTICAL_TEXT_ROTATION;
        }
        this.textLayer.appendText(geom);
      }

      return canvasWidth;
    },
    // @ts-expect-error
    showSpacedText (arr) {
      var ctx = this.ctx;
      var current = this.current;
      var font = current.font;
      var fontSize = current.fontSize;
      // TJ array's number is independent from fontMatrix
      var textHScale = current.textHScale * 0.001 * current.fontDirection;
      var arrLength = arr.length;
      var textLayer = this.textLayer;
      var geom;
      var canvasWidth = 0.0;
      var textSelection = textLayer ? true : false;
      var vertical = font.vertical;
      var spacingAccumulator = 0;

      if (textSelection) {
        ctx.save();
        this.applyTextTransforms();
        geom = this.createTextGeometry();
        ctx.restore();
      }

//MQZ Nov.28.2012 Adjust Text Positions, and also make it a string
      // @ts-expect-error
      var stGlyphs = [];
      var spaceWidth = font.spaceWidth;
      if (!font.spaceWidth) {
          var spaceId = isArray(font.toFontChar) ? font.toFontChar.indexOf(32) : -1;
          spaceWidth = (spaceId >= 0 && isArray(font.widths)) ? font.widths[spaceId] : 250;
      }

      for (var i = 0; i < arrLength; ++i) {
        var e = arr[i];
        if (isNum(e)) {
          var spacingLength = -e * fontSize * textHScale;
//MQZ. Dec.04.2013 Disable character based rendering - remove kerning
          if (stGlyphs.length === 0) {
              if (vertical) {
                current.y += spacingLength;
              } else {
                current.x += spacingLength;
              }
          }
          else {
            //MQZ-GYJ. Apr.20.2017 split word when spacing is a positive number but very big
              if (Math.abs(e) >= spaceWidth) {
                  if (vertical) {
                      current.y += spacingLength;
                  } else {
                      this.showText(stGlyphs, true);
                      stGlyphs = [];
                      current.x += spacingLength;
                  }
              }
          }

          if (textSelection)
            spacingAccumulator += spacingLength;
        } else {
//MQZ. Dec.04.2013 Disable character based rendering - make it a string
//          var shownCanvasWidth = this.showText(e, true);
//
//          if (textSelection) {
//            canvasWidth += spacingAccumulator + shownCanvasWidth;
//            spacingAccumulator = 0;
//          }

            // @ts-expect-error
            stGlyphs = stGlyphs.concat(e);
        }
      }

//MQZ. Nov.28.2012 Disable character based rendering, make it a string
        if (stGlyphs.length) {
            var shownCanvasWidth = this.showText(stGlyphs, true);
            if (textSelection)
              canvasWidth += shownCanvasWidth;
        }

      if (textSelection) {
        geom.canvasWidth = canvasWidth;
        if (vertical) {
          var VERTICAL_TEXT_ROTATION = Math.PI / 2;
          geom.angle += VERTICAL_TEXT_ROTATION;
        }
        this.textLayer.appendText(geom);
      }
    },
    // @ts-expect-error
    nextLineShowText: function CanvasGraphics_nextLineShowText(text) {
      this.nextLine();
      this.showText(text);
    },
    // @ts-expect-error
    nextLineSetSpacingShowText (wordSpacing, charSpacing, text) {
      this.setWordSpacing(wordSpacing);
      this.setCharSpacing(charSpacing);
      this.nextLineShowText(text);
    },

    // Type3 fonts
    // @ts-expect-error
    setCharWidth: function CanvasGraphics_setCharWidth(xWidth, yWidth) {
      // We can safely ignore this since the width should be the same
      // as the width in the Widths array.
    },
    // @ts-expect-error
    setCharWidthAndBounds (xWidth, yWidth, llx, lly, urx, ury) {
      // TODO According to the spec we're also suppose to ignore any operators
      // that set color or include images while processing this type3 font.
      this.rectangle(llx, lly, urx - llx, ury - lly);
      this.clip();
      this.endPath();
    },

    setStrokeColor: function CanvasGraphics_setStrokeColor(/*...*/) {
      var cs = this.current.strokeColorSpace;
      var rgbColor = cs.getRgb(arguments, 0);
      var color = Util.makeCssRgb(rgbColor);
      this.ctx.strokeStyle = color;
      this.current.strokeColor = color;
    },
    setStrokeColorN: function CanvasGraphics_setStrokeColorN(/*...*/) {
      this.setStrokeColor.apply(this, arguments);
    },
    setFillColor: function CanvasGraphics_setFillColor(/*...*/) {
      var cs = this.current.fillColorSpace;
      var rgbColor = cs.getRgb(arguments, 0);
      var color = Util.makeCssRgb(rgbColor);
      this.ctx.fillStyle = color;
      this.current.fillColor = color;
    },
    setFillColorN: function CanvasGraphics_setFillColorN(/*...*/) {
      this.setFillColor.apply(this, arguments);
    },
    // @ts-expect-error
    setStrokeGray: function CanvasGraphics_setStrokeGray(gray) {
      this.current.strokeColorSpace = ColorSpace.singletons.gray;

      var rgbColor = this.current.strokeColorSpace.getRgb(arguments, 0);
      var color = Util.makeCssRgb(rgbColor);
      this.ctx.strokeStyle = color;
      this.current.strokeColor = color;
    },
    // @ts-expect-error
    setStrokeRGBColor: function CanvasGraphics_setStrokeRGBColor(r, g, b) {
      this.current.strokeColorSpace = ColorSpace.singletons.rgb;

      var rgbColor = this.current.strokeColorSpace.getRgb(arguments, 0);
      var color = Util.makeCssRgb(rgbColor);
      this.ctx.strokeStyle = color;
      this.current.strokeColor = color;
    },
    // @ts-expect-error
    setFillRGBColor (r, g, b) {
      this.current.fillColorSpace = ColorSpace.singletons.rgb;

      var rgbColor = this.current.fillColorSpace.getRgb(arguments, 0);
      var color = Util.makeCssRgb(rgbColor);
      this.ctx.fillStyle = color;
      this.current.fillColor = color;
    },


    // @ts-expect-error
    paintFormXObjectBegin (matrix, bbox) {
      this.save();
      this.current.paintFormXObjectDepth++;
      this.baseTransformStack.push(this.baseTransform);

      if (matrix && isArray(matrix) && 6 == matrix.length)
        this.transform.apply(this, matrix);

      this.baseTransform = this.ctx.mozCurrentTransform;

      if (bbox && isArray(bbox) && 4 == bbox.length) {
        var width = bbox[2] - bbox[0];
        var height = bbox[3] - bbox[1];
        this.rectangle(bbox[0], bbox[1], width, height);
        this.clip();
        this.endPath();
      }
    },

    paintFormXObjectEnd () {
      var depth = this.current.paintFormXObjectDepth;
      do {
        this.restore();
        this.current.paintFormXObjectDepth--;
        // some pdf don't close all restores inside object
        // closing those for them
      } while (this.current.paintFormXObjectDepth >= depth);
      this.baseTransform = this.baseTransformStack.pop();
    },

    // Helper functions
    consumePath: function CanvasGraphics_consumePath() {
      if (this.pendingClip) {
        if (this.pendingClip == EO_CLIP) {
          if ('mozFillRule' in this.ctx) {
            this.ctx.mozFillRule = 'evenodd';
            this.ctx.clip();
            this.ctx.mozFillRule = 'nonzero';
          } else {
            try {
              this.ctx.clip('evenodd');
            } catch (ex) {
              // shouldn't really happen, but browsers might think differently
              this.ctx.clip();
            }
          }
        } else {
          this.ctx.clip();
        }
        this.pendingClip = null;
      }

      this.ctx.beginPath();
    },

    // @ts-expect-error
    getSinglePixelWidth: function CanvasGraphics_getSinglePixelWidth(scale) {
      var inverse = this.ctx.mozCurrentTransformInverse;
      // max of the current horizontal and vertical scale
      return Math.sqrt(Math.max(
        (inverse[0] * inverse[0] + inverse[1] * inverse[1]),
        (inverse[2] * inverse[2] + inverse[3] * inverse[3])));
    },
      
    // @ts-expect-error
    getCanvasPosition: function CanvasGraphics_getCanvasPosition(x, y) {
        var transform = this.ctx.mozCurrentTransform;
        return [
          transform[0] * x + transform[2] * y + transform[4],
          transform[1] * x + transform[3] * y + transform[5]
        ];
    }
  };

  for (const op in OPS) {
    // @ts-expect-error
    CanvasGraphics.prototype[OPS[op]] = CanvasGraphics.prototype[op];
  }

  return CanvasGraphics;
})();

