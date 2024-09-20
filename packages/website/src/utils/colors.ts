const componentToHex = (c: number): string => {
  try {
    const hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }
  catch {
    return "00";
  }
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const black = "black";
const white = "white";

// http://www.w3.org/TR/AERT#color-contrast
export const textColorOnCustomBackground = (color: string, reversed = false) => {
  const [r, g, b] = color.split(",").map(Number);
  const brightness = Math.round(((r * 299) + (g * 587) + (b * 114)) / 1000);

  const output = (brightness > 125) ? black : white;

  if (reversed) {
    return output === black ? white : black;
  }

  return output;
};
