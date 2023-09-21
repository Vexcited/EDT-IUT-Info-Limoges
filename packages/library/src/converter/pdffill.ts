import type { Canvas } from "./pdfcanvas";
import PDFUnit from "./pdfunit";

export default class PDFFill{
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;

  constructor(x: number, y: number, width: number, height: number, color: string) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
  }

  processFill (targetData: Canvas): void {
    const clrId = PDFUnit.findColorIndex(this.color);
    const colorObj = (clrId > 0 && clrId < PDFUnit.colorCount()) ? {clr: clrId} : {oc: this.color};

    const oneFill = {
      x: this.x,
      y: this.y,
      w: this.width,
      h: this.height,
      ...colorObj
    };

    
    if (oneFill.w < 2 && oneFill.h < 2) {
        return; //skip short thick lines, like PA SPP lines behinds checkbox
    }

    targetData.Fills.push(oneFill);
  }
}