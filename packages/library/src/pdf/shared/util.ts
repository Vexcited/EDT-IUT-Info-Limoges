import { Cmd, Dict, Name, Ref } from "../core/obj";
import { Stream } from "../core/stream";

export const FONT_IDENTITY_MATRIX = [0.001, 0, 0, 0.001, 0, 0];

export enum TextRenderingMode {
  FILL = 0,
  STROKE = 1,
  FILL_STROKE = 2,
  INVISIBLE = 3,
  FILL_ADD_TO_PATH = 4,
  STROKE_ADD_TO_PATH = 5,
  FILL_STROKE_ADD_TO_PATH = 6,
  ADD_TO_PATH = 7,
  FILL_STROKE_MASK = 3,
  ADD_TO_PATH_FLAG = 4
};

// All the possible operations for an operator list.
export const OPS = {
  // Intentionally start from 1 so it is easy to spot bad operators that will be
  // 0's.
  dependency: 1,
  setLineWidth: 2,
  setLineCap: 3,
  setLineJoin: 4,
  setMiterLimit: 5,
  setDash: 6,
  setRenderingIntent: 7,
  setFlatness: 8,
  setGState: 9,
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  clip: 29,
  eoClip: 30,
  beginText: 31,
  endText: 32,
  setCharSpacing: 33,
  setWordSpacing: 34,
  setHScale: 35,
  setLeading: 36,
  setFont: 37,
  setTextRenderingMode: 38,
  setTextRise: 39,
  moveText: 40,
  setLeadingMoveText: 41,
  setTextMatrix: 42,
  nextLine: 43,
  showText: 44,
  showSpacedText: 45,
  nextLineShowText: 46,
  nextLineSetSpacingShowText: 47,
  setStrokeColorSpace: 50,
  setFillColorSpace: 51,
  setStrokeColor: 52,
  setStrokeColorN: 53,
  setFillColor: 54,
  setFillColorN: 55,
  setStrokeGray: 56,
  setStrokeRGBColor: 58,
  setFillRGBColor: 59,
  beginInlineImage: 63,
  beginImageData: 64,
  endInlineImage: 65,
  paintXObject: 66,
  markPoint: 67,
  markPointProps: 68,
  beginMarkedContent: 69,
  beginMarkedContentProps: 70,
  endMarkedContent: 71,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  beginGroup: 76,
  endGroup: 77,
};

//MQZ.Mar.22 Disabled Operators (to prevent image painting & annotation default appearance)
//paintJpegXObject, paintImageMaskXObject, paintImageMaskXObjectGroup, paintImageXObject, paintInlineImageXObject, paintInlineImageXObjectGroup
export const NO_OPS = [82, 83, 84, 85, 86, 87];
export const NO_OPS_RANGE = [78, 79, 80, 81]; //range pairs, all ops with each pair will be skipped. !important!

// @ts-expect-error
export function assert(cond, msg) {
  if (!cond)
    throw new Error(msg);
}

// @ts-expect-error
export function shadow(obj, prop, value) {
  Object.defineProperty(obj, prop, { value: value,
                                     enumerable: true,
                                     configurable: true,
                                     writable: false });
  return value;
}

// @ts-expect-error
export function bytesToString(bytes) {
  var str = '';
  var length = bytes.length;
  for (var n = 0; n < length; ++n)
    str += String.fromCharCode(bytes[n]);
  return str;
}

// @ts-expect-error
export function stringToBytes(str) {
  var length = str.length;
  var bytes = new Uint8Array(length);
  for (var n = 0; n < length; ++n) {
    bytes[n] = str.charCodeAt(n) & 0xFF;
  }

  return bytes;
}

export var IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

export class Util {
  // @ts-expect-error
  static makeCssRgb = function Util_makeCssRgb(rgb) {
    return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
  };

  // For 2d affine transforms
  // @ts-expect-error
  static applyTransform = function Util_applyTransform(p, m) {
    var xt = p[0] * m[0] + p[1] * m[2] + m[4];
    var yt = p[0] * m[1] + p[1] * m[3] + m[5];
    return [xt, yt];
  };

  // @ts-expect-error
  static applyInverseTransform (p, m) {
    var d = m[0] * m[3] - m[1] * m[2];
    var xt = (p[0] * m[3] - p[1] * m[2] + m[2] * m[5] - m[4] * m[3]) / d;
    var yt = (-p[0] * m[1] + p[1] * m[0] + m[4] * m[1] - m[5] * m[0]) / d;
    return [xt, yt];
  };

  // Returns a rectangle [x1, y1, x2, y2] corresponding to the
  // intersection of rect1 and rect2. If no intersection, returns 'null'
  // The rectangle coordinates of rect1, rect2 should be [x1, y1, x2, y2]
  // @ts-expect-error
  static intersect = function Util_intersect(rect1, rect2) {
    const xLow = Math.max(
      Math.min(rect1[0], rect1[2]),
      Math.min(rect2[0], rect2[2])
    );
    const xHigh = Math.min(
      Math.max(rect1[0], rect1[2]),
      Math.max(rect2[0], rect2[2])
    );
    if (xLow > xHigh) {
      return null;
    }
    const yLow = Math.max(
      Math.min(rect1[1], rect1[3]),
      Math.min(rect2[1], rect2[3])
    );
    const yHigh = Math.min(
      Math.max(rect1[1], rect1[3]),
      Math.max(rect2[1], rect2[3])
    );
    if (yLow > yHigh) {
      return null;
    }

    return [xLow, yLow, xHigh, yHigh];
  };
}

export class PageViewport {
  public width: number;
  public height: number;

  // @ts-expect-error
  constructor (viewBox, scale, rotation, offsetX, offsetY, dontFlip) {
    // @ts-expect-error
    this.viewBox = viewBox;
    // @ts-expect-error
    this.scale = scale;
    // @ts-expect-error
    this.rotation = rotation;
    // @ts-expect-error
    this.offsetX = offsetX;
    // @ts-expect-error
    this.offsetY = offsetY;

    // creating transform to convert pdf coordinate system to the normal
    // canvas like coordinates taking in account scale and rotation
    var centerX = (viewBox[2] + viewBox[0]) / 2;
    var centerY = (viewBox[3] + viewBox[1]) / 2;
    var rotateA, rotateB, rotateC, rotateD;
    rotation = rotation % 360;
    rotation = rotation < 0 ? rotation + 360 : rotation;
    switch (rotation) {
      case 180:
        rotateA = -1; rotateB = 0; rotateC = 0; rotateD = 1;
        break;
      case 90:
        rotateA = 0; rotateB = 1; rotateC = 1; rotateD = 0;
        break;
      case 270:
        rotateA = 0; rotateB = -1; rotateC = -1; rotateD = 0;
        break;
      //case 0:
      default:
        rotateA = 1; rotateB = 0; rotateC = 0; rotateD = -1;
        break;
    }

    if (dontFlip) {
      rotateC = -rotateC; rotateD = -rotateD;
    }

    var offsetCanvasX, offsetCanvasY;
    var width, height;
    if (rotateA === 0) {
      offsetCanvasX = Math.abs(centerY - viewBox[1]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerX - viewBox[0]) * scale + offsetY;
      width = Math.abs(viewBox[3] - viewBox[1]) * scale;
      height = Math.abs(viewBox[2] - viewBox[0]) * scale;
    } else {
      offsetCanvasX = Math.abs(centerX - viewBox[0]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerY - viewBox[1]) * scale + offsetY;
      width = Math.abs(viewBox[2] - viewBox[0]) * scale;
      height = Math.abs(viewBox[3] - viewBox[1]) * scale;
    }
    // creating transform for the following operations:
    // translate(-centerX, -centerY), rotate and flip vertically,
    // scale, and translate(offsetCanvasX, offsetCanvasY)
    // @ts-expect-error
    this.transform = [
      rotateA * scale,
      rotateB * scale,
      rotateC * scale,
      rotateD * scale,
      offsetCanvasX - rotateA * scale * centerX - rotateC * scale * centerY,
      offsetCanvasY - rotateB * scale * centerX - rotateD * scale * centerY
    ];

    this.width = width;
    this.height = height;
    // @ts-expect-error
    this.fontScale = scale;
  }

  // @ts-expect-error
  clone (args) {
    args = args || {};
    // @ts-expect-error
    var scale = 'scale' in args ? args.scale : this.scale;
    // @ts-expect-error
    var rotation = 'rotation' in args ? args.rotation : this.rotation;
    // @ts-expect-error
    return new PageViewport(this.viewBox.slice(), scale, rotation, this.offsetX, this.offsetY, args.dontFlip);
  }

  // @ts-expect-error
  convertToViewportPoint (x, y) {
    // @ts-expect-error
    return Util.applyTransform([x, y], this.transform);
  }

  // @ts-expect-error
  convertToViewportRectangle (rect) {
    // @ts-expect-error
    var tl = Util.applyTransform([rect[0], rect[1]], this.transform);
    // @ts-expect-error
    var br = Util.applyTransform([rect[2], rect[3]], this.transform);
    return [tl[0], tl[1], br[0], br[1]];
  }
  // @ts-expect-error
  convertToPdfPoint (x, y) {
    // @ts-expect-error
    return Util.applyInverseTransform([x, y], this.transform);
  }
}

export const PDFStringTranslateTable = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0x2D8, 0x2C7, 0x2C6, 0x2D9, 0x2DD, 0x2DB, 0x2DA, 0x2DC, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x2022, 0x2020, 0x2021, 0x2026, 0x2014,
  0x2013, 0x192, 0x2044, 0x2039, 0x203A, 0x2212, 0x2030, 0x201E, 0x201C,
  0x201D, 0x2018, 0x2019, 0x201A, 0x2122, 0xFB01, 0xFB02, 0x141, 0x152, 0x160,
  0x178, 0x17D, 0x131, 0x142, 0x153, 0x161, 0x17E, 0, 0x20AC
];

// @ts-expect-error
export function stringToPDFString(str) {
  var i, n = str.length, str2 = '';
  if (str[0] === '\xFE' && str[1] === '\xFF') {
    // UTF16BE BOM
    for (i = 2; i < n; i += 2)
      str2 += String.fromCharCode(
        (str.charCodeAt(i) << 8) | str.charCodeAt(i + 1));
  } else {
    for (i = 0; i < n; ++i) {
      var code = PDFStringTranslateTable[str.charCodeAt(i)];
      str2 += code ? String.fromCharCode(code) : str.charAt(i);
    }
  }
  return str2;
}

// @ts-expect-error
export function stringToUTF8String(str) {
  return decodeURIComponent(escape(str));
}

// @ts-expect-error
export function isEmptyObj(obj) {
  for (var key in obj) {
    return false;
  }
  return true;
}

export function isBool(v: any): v is boolean {
  return typeof v == 'boolean';
}

export function isInt(v: any): v is number {
  return typeof v == 'number' && ((v | 0) == v);
}

export function isNum(v: any): v is number {
  return typeof v == 'number';
}

export function isString (v: any): v is string {
  return typeof v == 'string';
}

export function isNull (v: any): v is null {
  return v === null;
}

export function isName (v: any): v is Name {
  return v instanceof Name;
}

export function isCmd (v: any, cmd?: string): v is Cmd {
  return v instanceof Cmd && (!cmd || v.cmd == cmd);
}

export function isDict (v: any, type?: string): v is Dict {
  if (!(v instanceof Dict)) {
    return false;
  }
  if (!type) {
    return true;
  }
  var dictType = v.get('Type');
  return isName(dictType) && dictType.name == type;
}

export function isArray (v: any): v is Array<any> {
  return v instanceof Array;
}

export function isStream (v: any): v is Stream {
  return typeof v == 'object' && v !== null && v !== undefined &&
    ('getBytes' in v);
}

export function isArrayBuffer (v: any): v is ArrayBuffer {
  return typeof v == 'object' && v !== null && v !== undefined &&
    ('byteLength' in v);
}

export function isRef (v: any): v is Ref {
  return v instanceof Ref;
}

export function isPDFFunction (v: any): v is Dict | Stream {
  let fnDict;

  if (typeof v != 'object')
    return false;
  else if (isDict(v))
    fnDict = v;
  else if (isStream(v))
    fnDict = v.dict;
  else
    return false;
  
    return fnDict!.has('FunctionType');
}
