import type { Fill, Line, Text } from "./types";

import PDFLine from "./pdfline";
import PDFFill from "./pdffill";
import PDFFont, { FontObject } from "./pdffont";

const { sin: ms, cos: mc, abs, sqrt } = Math;    

// pre-compute "00" to "FF"
const dec2hex: string[] = [];
for (let i = 0; i < 16; i++) {
  for (let j = 0; j < 16; j++) {
    dec2hex[i * 16 + j] = i.toString(16) + j.toString(16);
  }
}

function createMatrixIdentity () {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
}

function matrixMultiply(m1: Array<Array<number>>, m2: Array<Array<number>>): Array<Array<number>> {
  let result = createMatrixIdentity();

  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      let sum = 0;

      for (let z = 0; z < 3; z++) {
        sum += m1[x][z] * m2[z][y];
      }

      result[x][y] = sum;
    }
  }

  return result;
}

const copyState = (o1: Partial<CanvasRenderingContext2D_>, o2: Partial<CanvasRenderingContext2D_>) => {
  o2.fillStyle = o1.fillStyle;
  o2.lineCap = o1.lineCap;
  o2.lineJoin = o1.lineJoin;
  o2.lineWidth = o1.lineWidth;
  o2.miterLimit = o1.miterLimit;
  o2.shadowBlur = o1.shadowBlur;
  o2.shadowColor = o1.shadowColor;
  o2.shadowOffsetX = o1.shadowOffsetX;
  o2.shadowOffsetY = o1.shadowOffsetY;
  o2.strokeStyle = o1.strokeStyle;
  o2.globalAlpha = o1.globalAlpha;
  o2.arcScaleX_ = o1.arcScaleX_;
  o2.arcScaleY_ = o1.arcScaleY_;
  o2.lineScale_ = o1.lineScale_;
  o2.dashArray = o1.dashArray;
}

const processStyle = (styleString: string) => {
  let str: string;
  let alpha: number = 1;

  styleString = String(styleString);
  if (styleString.substring(0, 3) == 'rgb') {
      let start = styleString.indexOf('(', 3);
      let end = styleString.indexOf(')', start + 1);
      let guts = styleString.substring(start + 1, end).split(',');

      str = '#';
      for (let i = 0; i < 3; i++) {
          str += dec2hex[Number(guts[i])];
      }

      if (guts.length == 4 && styleString.substring(3, 4) == 'a') {
        alpha = parseInt(guts[3]);
      }
  }
  else {
    str = styleString;
  }

  return { color: str, alpha: alpha };
}

// Helper function that takes the already fixed cordinates.
function bezierCurveToHelper(self: CanvasRenderingContext2D_, cp1: Point, cp2: Point, p: Point) {
  self.currentPath_.push({
    type: 'bezierCurveTo',
    cp1x: cp1.x,
    cp1y: cp1.y,
    cp2x: cp2.x,
    cp2y: cp2.y,
    x: p.x,
    y: p.y
  });
  
  self.currentX_ = p.x;
  self.currentY_ = p.y;
}

function matrixIsFinite(m: Array<Array<number>>) {
    for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 2; k++) {
            if (!isFinite(m[j][k]) || isNaN(m[j][k])) {
                return false;
            }
        }
    }
    return true;
}

function setM(ctx: CanvasRenderingContext2D_, m: Array<Array<number>>, updateLineScale?: boolean) {
  if (!matrixIsFinite(m)) return;
  ctx.m_ = m;

  if (updateLineScale) {
    // Get the line scale.
    // Determinant of this.m_ means how much the area is enlarged by the
    // transformation. So its square root can be used as a scale factor
    // for width.
    let det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    ctx.lineScale_ = sqrt(abs(det));
  }
}

class CanvasPattern_ {
    constructor() {        
    }
}

// Gradient / Pattern Stubs
class CanvasGradient_ {
  type_: string;
  x0_: number;
  y0_: number;
  r0_: number;
  x1_: number;
  y1_: number;
  r1_: number;
  colors_: Array<any>;
  
  constructor (aType: string) {
    this.type_ = aType;
    this.x0_ = 0;
    this.y0_ = 0;
    this.r0_ = 0;
    this.x1_ = 0;
    this.y1_ = 0;
    this.r1_ = 0;
    this.colors_ = [];
  }

  addColorStop(aOffset: number, aColor: string) {
    const paColor = processStyle(aColor);
    this.colors_.push({
      offset: aOffset,
      color: paColor.color,
      alpha: paColor.alpha
    });
  }    
}

export interface Canvas {
  HLines: Line[],
  VLines: Line[],
  Fills: Fill[],
  Texts: Text[]
}

interface Point { x: number, y: number }

/**
 * This class implements CanvasRenderingContext2D interface as described by
 * the WHATWG.
 * @param {HTMLElement} surfaceElement The element that the 2D context should
 * be associated with
 */
export default class CanvasRenderingContext2D_ {
  public canvas: Canvas;

  m_: Array<Array<number>>;
  mStack_: Array<Array<Array<number>>>;
  aStack_: Array<any>;
  currentPath_: Array<any>;

  strokeStyle: string;
  fillStyle: string;

  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  dashArray: any[];
  miterLimit: number;
  globalAlpha: number;

  width: number;
  height: number;

  arcScaleX_: number;
  arcScaleY_: number;
  lineScale_: number;

  currentFont: PDFFont | null;
  currentX_: number = -1;
  currentY_: number = -1;

  shadowBlur: number | undefined;
  shadowColor: string | undefined;
  shadowOffsetX: number | undefined;
  shadowOffsetY: number | undefined;

  constructor(canvasTarget: Partial<Canvas>, scaledWidth: number, scaledHeight: number) {
      this.m_ = createMatrixIdentity();

      this.mStack_ = [];
      this.aStack_ = [];
      this.currentPath_ = [];

      // Canvas context properties
      this.strokeStyle = '#000';
      this.fillStyle = '#000';

      this.lineWidth = 1;
      this.lineJoin = 'miter';
      this.lineCap = 'butt';
      this.dashArray = [];
      this.miterLimit = 1;
      this.globalAlpha = 1;

      if (!("HLines" in canvasTarget) || !Array.isArray(canvasTarget.HLines))
          canvasTarget.HLines = [];
      if (!("VLines" in canvasTarget) || !Array.isArray(canvasTarget.VLines))
          canvasTarget.VLines = [];
      if (!("Fills" in canvasTarget) || !Array.isArray(canvasTarget.Fills))
          canvasTarget.Fills = [];
      if (!("Texts" in canvasTarget) || !Array.isArray(canvasTarget.Texts))
          canvasTarget.Texts = [];

      this.canvas = canvasTarget as Canvas;

      this.width = scaledWidth;
      this.height = scaledHeight;

      this.arcScaleX_ = 1;
      this.arcScaleY_ = 1;
      this.lineScale_ = 1;

      this.currentFont = null;
    }

    //private helper methods
    #drawPDFLine(p1: Point, p2: Point, lineWidth: number, color: string) {
      let dashedLine = Array.isArray(this.dashArray) && (this.dashArray.length > 1);
      let pL = new PDFLine(p1.x, p1.y, p2.x, p2.y, lineWidth, color, dashedLine);
      pL.processLine(this.canvas);
    }

    #drawPDFFill(cp: Point, min: Point, max: Point, color: string) {
      let width = max.x - min.x;
      let height = max.y - min.y;
      let pF = new PDFFill(cp.x, cp.y, width, height, color);
      pF.processFill(this.canvas);
    }

    #needRemoveRect(x: number, y: number, w: number, h: number): boolean {
      let retVal = (Math.abs(w - Math.abs(h)) < 1 && w < 13);
      return retVal;
    }

    getContext(ctxType: "2d") {
      return (ctxType === "2d") ? this : null;
    }

    setLineDash(lineDash: any[]): void {
      this.dashArray = lineDash;
    }

    getLineDash() {
      return this.dashArray;
    }

    fillText (text: string, x: number, y: number, maxWidth: number, fontSize: number) {
        if (!text || text.trim().length < 1)
            return;
        let p = this.getCoords_(x, y);

        let a = processStyle(this.fillStyle || this.strokeStyle);
        let color = (!!a) ? a.color : '#000000';

        this.currentFont?.processText(p, text, maxWidth, color, fontSize, this.canvas, this.m_);
    };

    strokeText(text: string, x: number, y: number, maxWidth: number) {
      // i added 12 for type but actually what to do with it?
      this.fillText(text, x, y, maxWidth, 12);
    }

    measureText(text: string) {
      console.warn("to be implemented: contextPrototype.measureText - ", text);
      let chars = text.length || 1;
      return {width: chars * (this.currentFont?.spaceWidth || 5)};
    }

    setFont(fontObj: FontObject) {
      if (!!this.currentFont) {
        this.currentFont = null;
      }

      this.currentFont = new PDFFont(fontObj);
    }

    clearRect() {
        console.warn("to be implemented: contextPrototype.clearRect");
    }

    beginPath() {
      this.currentPath_ = [];
    }

    moveTo(aX: number, aY: number) {
      let p = this.getCoords_(aX, aY);
      this.currentPath_.push({type:'moveTo', x:p.x, y:p.y});
      this.currentX_ = p.x;
      this.currentY_ = p.y;
    }

    lineTo(aX: number, aY: number) {
      let p = this.getCoords_(aX, aY);
      this.currentPath_.push({type:'lineTo', x:p.x, y:p.y});

      this.currentX_ = p.x;
      this.currentY_ = p.y;
    }

    bezierCurveTo(aCP1x: number, aCP1y: number, aCP2x: number, aCP2y: number, aX: number, aY: number) {
      let p = this.getCoords_(aX, aY);
      let cp1 = this.getCoords_(aCP1x, aCP1y);
      let cp2 = this.getCoords_(aCP2x, aCP2y);
      bezierCurveToHelper(this, cp1, cp2, p);
    }

    quadraticCurveTo(aCPx: number, aCPy: number, aX: number, aY: number) {
        // the following is lifted almost directly from
        // http://developer.mozilla.org/en/docs/Canvas_tutorial:Drawing_shapes

        let cp = this.getCoords_(aCPx, aCPy);
        let p = this.getCoords_(aX, aY);

        let cp1 = {
            x:this.currentX_ + 2.0 / 3.0 * (cp.x - this.currentX_),
            y:this.currentY_ + 2.0 / 3.0 * (cp.y - this.currentY_)
        };
        let cp2 = {
            x:cp1.x + (p.x - this.currentX_) / 3.0,
            y:cp1.y + (p.y - this.currentY_) / 3.0
        };

        bezierCurveToHelper(this, cp1, cp2, p);
    }

    arc(aX: number, aY: number, aRadius: number, aStartAngle: number, aEndAngle: number, aClockwise: boolean) {
        let arcType = aClockwise ? 'at' : 'wa';

        let xStart = aX + mc(aStartAngle) * aRadius;
        let yStart = aY + ms(aStartAngle) * aRadius;

        let xEnd = aX + mc(aEndAngle) * aRadius;
        let yEnd = aY + ms(aEndAngle) * aRadius;

        // IE won't render arches drawn counter clockwise if xStart == xEnd.
        if (xStart == xEnd && !aClockwise) {
            xStart += 0.125; // Offset xStart by 1/80 of a pixel. Use something
            // that can be represented in binary
        }

        let p = this.getCoords_(aX, aY);
        let pStart = this.getCoords_(xStart, yStart);
        let pEnd = this.getCoords_(xEnd, yEnd);

        this.currentPath_.push({type:arcType,
            x:p.x,
            y:p.y,
            radius:aRadius,
            xStart:pStart.x,
            yStart:pStart.y,
            xEnd:pEnd.x,
            yEnd:pEnd.y});
    }

    rect(aX: number, aY: number, aWidth: number, aHeight: number) {
        if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
    }

    strokeRect(aX: number, aY: number, aWidth: number, aHeight: number) {
        if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        let oldPath = this.currentPath_;
        this.beginPath();

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
        this.stroke();

        this.currentPath_ = oldPath;
    }

    fillRect(aX: number, aY: number, aWidth: number, aHeight: number) {
        if (this.#needRemoveRect(aX, aY, aWidth, aHeight)) {
            return;//try to remove the rectangle behind radio buttons and checkboxes
        }

        let oldPath = this.currentPath_;
        this.beginPath();

        this.moveTo(aX, aY);
        this.lineTo(aX + aWidth, aY);
        this.lineTo(aX + aWidth, aY + aHeight);
        this.lineTo(aX, aY + aHeight);
        this.closePath();
        this.fill();

        this.currentPath_ = oldPath;
    }

    createLinearGradient(aX0: number, aY0: number, aX1: number, aY1: number) {
        let gradient = new CanvasGradient_('gradient');
        gradient.x0_ = aX0;
        gradient.y0_ = aY0;
        gradient.x1_ = aX1;
        gradient.y1_ = aY1;
        return gradient;
    }

    createRadialGradient(aX0: number, aY0: number, aR0: number, aX1: number, aY1: number, aR1: number) {
        let gradient = new CanvasGradient_('gradientradial');
        gradient.x0_ = aX0;
        gradient.y0_ = aY0;
        gradient.r0_ = aR0;
        gradient.x1_ = aX1;
        gradient.y1_ = aY1;
        gradient.r1_ = aR1;
        return gradient;
    }

    drawImage (): void {}

    /** Returns an empty buffer. */
    getImageData (x: number, y: number, w: number, h: number) {
      return {
        width: w, height: h,
        data: new Uint8Array(w * h * 4)
      };
    }

    stroke (aFill?: boolean) {
      if (this.currentPath_.length < 2) {
          return;
      }

      let a = processStyle(aFill ? this.fillStyle : this.strokeStyle);
      let color = a.color;
      let lineWidth = this.lineScale_ * this.lineWidth;

      let min = {x:null, y:null};
      let max = {x:null, y:null};

      for (let i = 0; i < this.currentPath_.length; i++) {
        let p = this.currentPath_[i];

        switch (p.type) {
            case 'moveTo':
                break;
            case 'lineTo':
                if (!aFill) { //lines
                    if (i > 0) {
                        this.#drawPDFLine(this.currentPath_[i-1], p, lineWidth, color);
                    }
                }
                break;
            case 'close':
                if (!aFill) { //lines
                    if (i > 0) {
                        this.#drawPDFLine(this.currentPath_[i-1], this.currentPath_[0], lineWidth, color);
                    }
                }
                p = null;
                break;
            case 'bezierCurveTo':
                break;
            case 'at':
            case 'wa':
                break;
        }

        // Figure out dimensions so we can set fills' coordinates correctly
        if (aFill && p) {
            if (min.x == null || p.x < min.x) {
                min.x = p.x;
            }
            if (max.x == null || p.x > max.x) {
                max.x = p.x;
            }
            if (min.y == null || p.y < min.y) {
                min.y = p.y;
            }
            if (max.y == null || p.y > max.y) {
                max.y = p.y;
            }
        }
      }

      if (aFill) {
        this.#drawPDFFill(min as unknown as Point, min as unknown as Point, max as unknown as Point, color);
      }
    }

    fill () {
      this.stroke(true);
    }

    closePath() {
      this.currentPath_.push({ type:'close' });
    }

    private getCoords_ (aX: number, aY: number) {
      let m = this.m_;
      return {
        x: (aX * m[0][0] + aY * m[1][0] + m[2][0]),
        y: (aX * m[0][1] + aY * m[1][1] + m[2][1])
      };
    }

    save () {
      let o = {};
      copyState(this, o);
      this.aStack_.push(o);
      this.mStack_.push(this.m_);
      this.m_ = matrixMultiply(createMatrixIdentity(), this.m_);
    }

    restore() {
      copyState(this.aStack_.pop(), this);
      // @ts-expect-error
      this.m_ = this.mStack_.pop();
    }

    translate(aX: number, aY: number) {
        let m1 = [
            [1, 0, 0],
            [0, 1, 0],
            [aX, aY, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), false);
    }

    rotate(aRot: number) {
        let c = mc(aRot);
        let s = ms(aRot);

        let m1 = [
            [c, s, 0],
            [-s, c, 0],
            [0, 0, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), false);
    }

    scale(aX: number, aY: number) {
        this.arcScaleX_ *= aX;
        this.arcScaleY_ *= aY;
        let m1 = [
            [aX, 0, 0],
            [0, aY, 0],
            [0, 0, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), true);
    }

    transform(m11: number, m12: number, m21: number, m22: number, dx: number, dy: number) {
        let m1 = [
            [m11, m12, 0],
            [m21, m22, 0],
            [dx, dy, 1]
        ];

        setM(this, matrixMultiply(m1, this.m_), true);
    }

    setTransform(m11: number, m12: number, m21: number, m22: number, dx: number, dy: number) {
        let m = [
            [m11, m12, 0],
            [m21, m22, 0],
            [dx, dy, 1]
        ];

        setM(this, m, true);
    }

    clip () {}
    arcTo () {}

    createPattern () {
      return new CanvasPattern_();
    }
}