/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals PDFJS, shadow, isWorker, assert, warn, bytesToString, globalScope */

'use strict';


class FontFace {
  constructor (name, file, properties) {
    this.compiledGlyphs = {};

    if (arguments.length === 1) {
      // importing translated data
      var data = arguments[0];
      for (var i in data) {
        this[i] = data[i];
      }
    }
  }

  bindDOM () {
    return null;
  }
  
  getPathGenerator (objs, character) {
    if (!(character in this.compiledGlyphs)) {
      var js = objs.get(this.loadedName + '_path_' + character);
      /*jshint -W054 */
      this.compiledGlyphs[character] = new Function('c', 'size', js);
    }

    return this.compiledGlyphs[character];
  }
}
