import type { Canvas } from "./pdfcanvas";
import PDFUnit from "./pdfunit";

interface OneLine {
  x: number
  y: number
  w: number
  l: number
  dsh?: number
  clr?: number
  oc?: string
}

export default class PDFLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lineWidth: number;
  color: string;
  dashed: boolean;

  constructor (x1: number, y1: number, x2: number, y2: number, lineWidth: number | undefined, color: string, dashed: boolean) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.lineWidth = lineWidth ?? 1.0;
    this.color = color;
    this.dashed = dashed;
  }

  #setStartPoint (oneLine: OneLine, x: number, y: number): void {
    oneLine.x = x;
    oneLine.y = y;
  }

  public processLine (targetData: Canvas) {
    const xDelta = Math.abs(this.x2 - this.x1);
    const yDelta = Math.abs(this.y2 - this.y1);
    const minDelta = this.lineWidth;

    let oneLine: OneLine = {
      x: 0, y: 0, l: 0,
      w: PDFUnit.toFixedFloat(this.lineWidth)
    };

    const clrId = PDFUnit.findColorIndex(this.color);
    const colorObj = (clrId > 0 && clrId < PDFUnit.colorCount()) ? { clr: clrId } : { oc: this.color };
    oneLine = { ...oneLine, ...colorObj };

        //MQZ Aug.29 dashed line support
        if (this.dashed) {
            oneLine = oneLine = {...oneLine, dsh: 1};
        }

        if ((yDelta < this.lineWidth) && (xDelta > minDelta)) { //HLine
            if (this.lineWidth < 4 && (xDelta / this.lineWidth < 4)) {
                return; //skip short thick lines, like PA SPP lines behinds checkbox
            }

            oneLine.l = xDelta;
            if (this.x1 > this.x2)
                this.#setStartPoint(oneLine, this.x2, this.y2);
            else
                this.#setStartPoint(oneLine, this.x1, this.y1);
            targetData.HLines.push(oneLine);
        }
        else if ((xDelta < this.lineWidth) && (yDelta > minDelta)) {//VLine
            if (this.lineWidth < 4 && (yDelta / this.lineWidth < 4)) {
                return; //skip short think lines, like PA SPP lines behinds checkbox
            }

            oneLine.l = yDelta;
            if (this.y1 > this.y2)
                this.#setStartPoint(oneLine, this.x2, this.y2);
            else
                this.#setStartPoint(oneLine, this.x1, this.y1);
            targetData.VLines.push(oneLine);
        }
    }
}