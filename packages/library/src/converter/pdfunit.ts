import { kColors } from "./pdfconst";

export default class PDFUnit {
    static toFixedFloat(fNum: number) {
      return parseFloat(fNum.toFixed(3));
    }

    static colorCount() {
      return kColors.length;
    }

    static getColorByIndex(clrId: number): string {
        return kColors[clrId];
    }

    static toFormPoint(viewportX: number, viewportY: number): [viewportX: number, viewportY: number] {
      return [viewportX, viewportY];
    }

    static findColorIndex (color: string): number {
      if (color.length === 4) color += "000";
      return kColors.indexOf(color);
    }

    static dateToIso8601(date: string) {
        // PDF spec p.160
        if (date.slice(0, 2) === 'D:') { // D: prefix is optional
            date = date.slice(2);
        }
        let tz = 'Z';
        let idx = date.search(/[Z+-]/); // timezone is optional
        if (idx >= 0) {
            tz = date.slice(idx);
            if (tz !== 'Z') { // timezone format OHH'mm'
                tz = tz.slice(0, 3) + ':' + tz.slice(4, 6);
            }
            date = date.slice(0, idx);
        }
        let yr = date.slice(0, 4); // everything after year is optional
        let mth = date.slice(4, 6) || '01';
        let day = date.slice(6, 8) || '01';
        let hr = date.slice(8, 10) || '00';
        let min = date.slice(10, 12) || '00';
        let sec = date.slice(12, 14) || '00';
        return yr + '-' + mth + '-' + day + 'T' + hr + ':' + min + ':' + sec + tz;
    }
}