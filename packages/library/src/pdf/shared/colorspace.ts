import { shadow } from "./util";

export class ColorSpace {
  static singletons = {
    get gray() {
      return shadow(this, 'gray', new DeviceGrayCS());
    },
    get rgb() {
      return shadow(this, 'rgb', new DeviceRgbCS());
    }
  };
}

export class DeviceGrayCS {
  public name = 'DeviceGray';
  public numComps = 1;
  public defaultColor = new Float32Array([0]);

  getRgb (src, srcOffset) {
    const rgb = new Uint8Array(3);
    this.getRgbItem(src, srcOffset, rgb, 0);
    return rgb;
  }

  getRgbItem (src, srcOffset, dest, destOffset) {
    let c = (src[srcOffset] * 255) | 0;
    c = c < 0 ? 0 : c > 255 ? 255 : c;
    dest[destOffset] = dest[destOffset + 1] = dest[destOffset + 2] = c;
  }
}

export class DeviceRgbCS {
  public name = 'DeviceRGB';
  public numComps = 3;
  public defaultColor = new Float32Array([0, 0, 0]);

  getRgb (src, srcOffset) {
    const rgb = new Uint8Array(3);
    this.getRgbItem(src, srcOffset, rgb, 0);
    return rgb;
  }

  getRgbItem (src, srcOffset, dest, destOffset) {
    const r = (src[srcOffset] * 255) | 0;
    const g = (src[srcOffset + 1] * 255) | 0;
    const b = (src[srcOffset + 2] * 255) | 0;
    dest[destOffset] = r < 0 ? 0 : r > 255 ? 255 : r;
    dest[destOffset + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    dest[destOffset + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}
