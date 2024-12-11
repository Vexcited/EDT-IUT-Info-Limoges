export class FontFace {
  // @ts-expect-error
  constructor (data) {
    // @ts-expect-error
    this.compiledGlyphs = {};
    
    for (const key in data) {
      // @ts-expect-error
      this[key] = data[key];
    }
  }

  bindDOM () {
    return null;
  }
  
  // @ts-expect-error
  getPathGenerator (objs, character) {
    // @ts-expect-error
    if (!(character in this.compiledGlyphs)) {
      // @ts-expect-error
      const js = objs.get(this.loadedName + '_path_' + character);
      // @ts-expect-error
      this.compiledGlyphs[character] = new Function('c', 'size', js);
    }
    
    // @ts-expect-error
    return this.compiledGlyphs[character];
  }
}
