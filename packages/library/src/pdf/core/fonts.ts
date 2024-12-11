function mapPrivateUseChars (code: number): number {
  switch (code) {
    case 0xF8E9: // copyrightsans
    case 0xF6D9: // copyrightserif
      return 0x00A9; // copyright
    default:
      return code;
  }
}

export class Font {
  // @ts-expect-error
  constructor (properties) {
    // @ts-expect-error
    this.differences = properties.differences;
    // @ts-expect-error
    this.encoding = properties.baseEncoding;
  }

  exportData () {
    const data = {};
    
    for (const key in this) {
      if (this.hasOwnProperty(key))
        // @ts-expect-error
        data[key] = this[key];
    }

    return data;
  }

  charToGlyph (charcode: number) {
    return {
      fontChar: String.fromCharCode(mapPrivateUseChars(charcode)),
      unicode: typeof charcode === 'number' ? String.fromCharCode(charcode) : charcode
    };
  }

  charsToGlyphs (chars: string) {
    // @ts-expect-error
    let charsCache = this.charsCache;
    let glyphs;

    // if we translated this string before, just grab it from the cache
    if (charsCache) {
      glyphs = charsCache[chars];
      if (glyphs) return glyphs;
    }

    // lazily create the translation cache
    if (!charsCache)
      // @ts-expect-error
      charsCache = this.charsCache = Object.create(null);

    glyphs = [];
    const charsCacheKey = chars;

    for (let i = 0, ii = chars.length; i < ii; ++i) {
      const charcode = chars.charCodeAt(i);
      const glyph = this.charToGlyph(charcode);
      glyphs.push(glyph);

      if (charcode == 0x20)
        glyphs.push(null);
    }

    return (charsCache[charsCacheKey] = glyphs);
  }
}
