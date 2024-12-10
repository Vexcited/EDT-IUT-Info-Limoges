export class FontFace {
  constructor (data) {
    this.compiledGlyphs = {};

    for (const key in data) {
      this[key] = data[key];
    }
  }

  bindDOM () {
    return null;
  }
  
  getPathGenerator (objs, character) {
    if (!(character in this.compiledGlyphs)) {
      const js = objs.get(this.loadedName + '_path_' + character);
      this.compiledGlyphs[character] = new Function('c', 'size', js);
    }

    return this.compiledGlyphs[character];
  }
}
