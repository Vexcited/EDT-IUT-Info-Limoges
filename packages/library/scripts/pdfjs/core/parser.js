'use strict';

const EOF = {};

function isEOF(v) {
  return v == EOF;
}

class Parser {
  constructor (lexer, allowStreams, xref) {
    this.lexer = lexer;
    this.allowStreams = allowStreams;
    this.xref = xref;
    this.refill();
  }

  saveState () {
    this.state = {
      buf1: this.buf1,
      buf2: this.buf2,
      streamPos: this.lexer.stream.pos
    };
  }

  restoreState () {
    var state = this.state;
    this.buf1 = state.buf1;
    this.buf2 = state.buf2;
    this.lexer.stream.pos = state.streamPos;
  }

  refill () {
    this.buf1 = this.lexer.getObj();
    this.buf2 = this.lexer.getObj();
  }

  shift () {
    if (isCmd(this.buf2, 'ID')) {
      this.buf1 = this.buf2;
      this.buf2 = null;
    } else {
      this.buf1 = this.buf2;
      this.buf2 = this.lexer.getObj();
    }
  }

  getObj () {
    if (isCmd(this.buf1, 'BI')) { // inline image
      this.shift();
      return this.makeInlineImage();
    }
    if (isCmd(this.buf1, '[')) { // array
      this.shift();
      var array = [];
      while (!isCmd(this.buf1, ']') && !isEOF(this.buf1))
        array.push(this.getObj());
      if (isEOF(this.buf1))
        throw new Error('End of file inside array');
      this.shift();
      return array;
    }
    if (isCmd(this.buf1, '<<')) { // dictionary or stream
      this.shift();
      var dict = new Dict(this.xref);
      while (!isCmd(this.buf1, '>>') && !isEOF(this.buf1)) {
        if (!isName(this.buf1)) {
          console.info('Malformed dictionary, key must be a name object');
          this.shift();
          continue;
        }

        var key = this.buf1.name;
        this.shift();
        if (isEOF(this.buf1))
          break;
        dict.set(key, this.getObj());
      }
      if (isEOF(this.buf1))
        throw new Error('End of file inside dictionary');

      // stream objects are not allowed inside content streams or
      // object streams
      if (isCmd(this.buf2, 'stream')) {
        return this.allowStreams ?
          this.makeStream(dict) : dict;
      }
      this.shift();
      return dict;
    }
    if (isInt(this.buf1)) { // indirect reference or integer
      var num = this.buf1;
      this.shift();
      if (isInt(this.buf1) && isCmd(this.buf2, 'R')) {
        var ref = new Ref(num, this.buf1);
        this.shift();
        this.shift();
        return ref;
      }
      return num;
    }
    if (isString(this.buf1)) { // string
      var str = this.buf1;
      this.shift();
      return str;
    }

    // simple object
    var obj = this.buf1;
    this.shift();
    return obj;
  }

  makeInlineImage () {
    var lexer = this.lexer;
    var stream = lexer.stream;

    // parse dictionary
    var dict = new Dict();
    while (!isCmd(this.buf1, 'ID') && !isEOF(this.buf1)) {
      if (!isName(this.buf1))
        throw new Error('Dictionary key must be a name object');

      var key = this.buf1.name;
      this.shift();
      if (isEOF(this.buf1))
        break;
      dict.set(key, this.getObj());
    }

    // parse image stream
    var startPos = stream.pos;

    // searching for the /EI\s/
    var state = 0, ch, i, ii;
    while (state != 4 && (ch = stream.getByte()) !== -1) {
      switch (ch | 0) {
        case 0x20:
        case 0x0D:
        case 0x0A:
          // let's check next five bytes to be ASCII... just be sure
          var followingBytes = stream.peekBytes(5);
          for (i = 0, ii = followingBytes.length; i < ii; i++) {
            ch = followingBytes[i];
            if (ch !== 0x0A && ch !== 0x0D && (ch < 0x20 || ch > 0x7F)) {
              // not a LF, CR, SPACE or any visible ASCII character
              state = 0;
              break; // some binary stuff found, resetting the state
            }
          }
          state = state === 3 ? 4 : 0;
          break;
        case 0x45:
          state = 2;
          break;
        case 0x49:
          state = state === 2 ? 3 : 0;
          break;
        default:
          state = 0;
          break;
      }
    }

    var length = (stream.pos - 4) - startPos;
    var imageStream = stream.makeSubStream(startPos, length, dict);
    imageStream = this.filter(imageStream, dict, length);
    imageStream.dict = dict;

    this.buf2 = Cmd.get('EI');
    this.shift();

    return imageStream;
  }

  fetchIfRef (obj) {
    // not relying on the xref.fetchIfRef -- xref might not be set
    return isRef(obj) ? this.xref.fetch(obj) : obj;
  }

  makeStream (dict) {
    var lexer = this.lexer;
    var stream = lexer.stream;

    // get stream start position
    lexer.skipToNextLine();
    var pos = stream.pos - 1;

    // get length
    var length = this.fetchIfRef(dict.get('Length'));
    if (!isInt(length)) {
      console.info('Bad ' + length + ' attribute in stream');
      length = 0;
    }

    // skip over the stream data
    stream.pos = pos + length;
    lexer.nextChar();

    this.shift(); // '>>'
    this.shift(); // 'stream'
    if (!isCmd(this.buf1, 'endstream')) {
      // bad stream length, scanning for endstream
      stream.pos = pos;
      var SCAN_BLOCK_SIZE = 2048;
      var ENDSTREAM_SIGNATURE_LENGTH = 9;
      var ENDSTREAM_SIGNATURE = [0x65, 0x6E, 0x64, 0x73, 0x74, 0x72, 0x65,
                                  0x61, 0x6D];
      var skipped = 0, found = false;
      while (stream.pos < stream.end) {
        var scanBytes = stream.peekBytes(SCAN_BLOCK_SIZE);
        var scanLength = scanBytes.length - ENDSTREAM_SIGNATURE_LENGTH;
        var found = false, i, ii, j;
        for (i = 0, j = 0; i < scanLength; i++) {
          var b = scanBytes[i];
          if (b !== ENDSTREAM_SIGNATURE[j]) {
            i -= j;
            j = 0;
          } else {
            j++;
            if (j >= ENDSTREAM_SIGNATURE_LENGTH) {
              found = true;
              break;
            }
          }
        }
        if (found) {
          skipped += i - ENDSTREAM_SIGNATURE_LENGTH;
          stream.pos += i - ENDSTREAM_SIGNATURE_LENGTH;
          break;
        }
        skipped += scanLength;
        stream.pos += scanLength;
      }
      if (!found) {
        throw new Error('Missing endstream');
      }
      length = skipped;

      lexer.nextChar();
      this.shift();
      this.shift();
    }
    this.shift(); // 'endstream'

    stream = stream.makeSubStream(pos, length, dict);
    stream = this.filter(stream, dict, length);
    stream.dict = dict;
    return stream;
  }

  filter (stream, dict, length) {
    var filter = this.fetchIfRef(dict.get('Filter', 'F'));
    var params = this.fetchIfRef(dict.get('DecodeParms', 'DP'));
    if (isName(filter))
      return this.makeFilter(stream, filter.name, length, params);
    if (isArray(filter)) {
      var filterArray = filter;
      var paramsArray = params;
      for (var i = 0, ii = filterArray.length; i < ii; ++i) {
        filter = filterArray[i];
        if (!isName(filter))
          throw new Error('Bad filter name: ' + filter);

        params = null;
        if (isArray(paramsArray) && (i in paramsArray))
          params = paramsArray[i];
        stream = this.makeFilter(stream, filter.name, length, params);
        // after the first stream the length variable is invalid
        length = null;
      }
    }
    return stream;
  }

  makeFilter (stream, name, length, params) {
    if (stream.dict.get('Length') === 0) {
      return new NullStream(stream);
    }
    if (name == 'FlateDecode' || name == 'Fl') {
      return new FlateStream(stream);
    }
    
    console.warn('filter "' + name + '" not supported yet');
    return stream;
  }
}

class Lexer {
  /**
   * @param {*} stream 
   * @param {Record<string, any>} knownCommands 
   */
  constructor (stream, knownCommands) {
    this.stream = stream;
    this.nextChar();

    // The PDFs might have "glued" commands with other commands, operands or
    // literals, e.g. "q1". The knownCommands is a dictionary of the valid
    // commands and their prefixes. The prefixes are built the following way:
    // if there a command that is a prefix of the other valid command or
    // literal (e.g. 'f' and 'false') the following prefixes must be included,
    // 'fa', 'fal', 'fals'. The prefixes are not needed, if the command has no
    // other commands or literals as a prefix. The knowCommands is optional.
    this.knownCommands = knownCommands;
  }

  static isSpace (ch) {
    // space is one of the following characters: SPACE, TAB, CR, or LF
    return ch === 0x20 || ch === 0x09 || ch === 0x0D || ch === 0x0A;
  };

  // A '1' in this array means the character is white space.  A '1' or
  // '2' means the character ends a name or command.
  static specialChars = [
    1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0,   // 0x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 1x
    1, 0, 0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2,   // 2x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0,   // 3x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 4x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0,   // 5x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 6x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 0,   // 7x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 8x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 9x
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // ax
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // bx
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // cx
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // dx
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // ex
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0    // fx
  ];

  static toHexDigit(ch) {
    if (ch >= 0x30 && ch <= 0x39) { // '0'-'9'
      return ch & 0x0F;
    }
    if ((ch >= 0x41 && ch <= 0x46) || (ch >= 0x61 && ch <= 0x66)) {
      // 'A'-'F', 'a'-'f'
      return (ch & 0x0F) + 9;
    }
    return -1;
  }

  nextChar () {
    return (this.currentChar = this.stream.getByte());
  }

  getNumber () {
    var floating = false;
    var ch = this.currentChar;
    var str = String.fromCharCode(ch);
    while ((ch = this.nextChar()) >= 0) {
      if (ch === 0x2E && !floating) { // '.'
        str += '.';
        floating = true;
      } else if (ch === 0x2D) { // '-'
        // ignore minus signs in the middle of numbers to match
        // Adobe's behavior
        console.warn('Badly formated number');
      } else if (ch >= 0x30 && ch <= 0x39) { // '0'-'9'
        str += String.fromCharCode(ch);
      } else if (ch === 0x45 || ch === 0x65) { // 'E', 'e'
        floating = true;
      } else {
        // the last character doesn't belong to us
        break;
      }
    }
    var value = parseFloat(str);
    if (isNaN(value))
      throw new Error('Invalid floating point number: ' + value);
    return value;
  }

  getString () {
    var numParen = 1;
    var done = false;
    var str = '';

    var ch = this.nextChar();
    while (true) {
      var charBuffered = false;
      switch (ch | 0) {
        case -1:
          console.warn('Unterminated string');
          done = true;
          break;
        case 0x28: // '('
          ++numParen;
          str += '(';
          break;
        case 0x29: // ')'
          if (--numParen === 0) {
            this.nextChar(); // consume strings ')'
            done = true;
          } else {
            str += ')';
          }
          break;
        case 0x5C: // '\\'
          ch = this.nextChar();
          switch (ch) {
            case -1:
              console.warn('Unterminated string');
              done = true;
              break;
            case 0x6E: // 'n'
              str += '\n';
              break;
            case 0x72: // 'r'
              str += '\r';
              break;
            case 0x74: // 't'
              str += '\t';
              break;
            case 0x62: // 'b'
              str += '\b';
              break;
            case 0x66: // 'f'
              str += '\f';
              break;
            case 0x5C: // '\'
            case 0x28: // '('
            case 0x29: // ')'
              str += String.fromCharCode(ch);
              break;
            case 0x30: case 0x31: case 0x32: case 0x33: // '0'-'3'
            case 0x34: case 0x35: case 0x36: case 0x37: // '4'-'7'
              var x = ch & 0x0F;
              ch = this.nextChar();
              charBuffered = true;
              if (ch >= 0x30 && ch <= 0x37) { // '0'-'7'
                x = (x << 3) + (ch & 0x0F);
                ch = this.nextChar();
                if (ch >= 0x30 && ch <= 0x37) {  // '0'-'7'
                  charBuffered = false;
                  x = (x << 3) + (ch & 0x0F);
                }
              }

              str += String.fromCharCode(x);
              break;
            case 0x0A: case 0x0D: // LF, CR
              break;
            default:
              str += String.fromCharCode(ch);
              break;
          }
          break;
        default:
          str += String.fromCharCode(ch);
          break;
      }
      if (done) {
        break;
      }
      if (!charBuffered) {
        ch = this.nextChar();
      }
    }
    return str;
  }

  getName () {
    let str = '';
    let ch;

    while ((ch = this.nextChar()) >= 0 && !Lexer.specialChars[ch]) {
      if (ch === 0x23) { // '#'
        ch = this.nextChar();
        const x = Lexer.toHexDigit(ch);
        
        if (x != -1) {
          const x2 = Lexer.toHexDigit(this.nextChar());
          if (x2 == -1)
            throw new Error('Illegal digit in hex char in name: ' + x2);
          str += String.fromCharCode((x << 4) | x2);
        }
        else {
          str += '#';
          str += String.fromCharCode(ch);
        }
      }
      else {
        str += String.fromCharCode(ch);
      }
    }
    
    if (str.length > 127) {
      console.warn('Name token is longer than allowed by the spec: ' + str.length);
    }

    return new Name(str);
  }

  getHexString () {
    let str = '';
    let ch = this.currentChar;
    let isFirstHex = true;
    let firstDigit;

    while (true) {
      if (ch < 0) {
        console.warn('Unterminated hex string');
        break;
      }
      else if (ch === 0x3E) { // '>'
        this.nextChar();
        break;
      }
      else if (Lexer.specialChars[ch] === 1) {
        ch = this.nextChar();
        continue;
      }
      else {
        if (isFirstHex) {
          firstDigit = Lexer.toHexDigit(ch);
          if (firstDigit === -1) {
            console.warn('Ignoring invalid character "' + ch + '" in hex string');
            ch = this.nextChar();
            continue;
          }
        }
        else {
          const secondDigit = Lexer.toHexDigit(ch);
          if (secondDigit === -1) {
            console.warn('Ignoring invalid character "' + ch + '" in hex string');
            ch = this.nextChar();
            continue;
          }
          str += String.fromCharCode((firstDigit << 4) | secondDigit);
        }

        isFirstHex = !isFirstHex;
        ch = this.nextChar();
      }
    }
    return str;
  }

  getObj () {
    let comment = false;
    let ch = this.currentChar;

    while (true) {
      if (ch < 0) return EOF;

      if (comment) {
        if (ch === 0x0A || ch == 0x0D) { // LF, CR
          comment = false;
        }
      }

      else if (ch === 0x25) { // '%'
        comment = true;
      }
      else if (Lexer.specialChars[ch] !== 1) {
        break;
      }
      
      ch = this.nextChar();
    }

    // start reading token
    switch (ch | 0) {
      case 0x30: case 0x31: case 0x32: case 0x33: case 0x34: // '0'-'4'
      case 0x35: case 0x36: case 0x37: case 0x38: case 0x39: // '5'-'9'
      case 0x2B: case 0x2D: case 0x2E: // '+', '-', '.'
        return this.getNumber();
      case 0x28: // '('
        return this.getString();
      case 0x2F: // '/'
        return this.getName();
      // array punctuation
      case 0x5B: // '['
        this.nextChar();
        return Cmd.get('[');
      case 0x5D: // ']'
        this.nextChar();
        return Cmd.get(']');
      // hex string or dict punctuation
      case 0x3C: // '<'
        ch = this.nextChar();
        if (ch === 0x3C) {
          // dict punctuation
          this.nextChar();
          return Cmd.get('<<');
        }
        return this.getHexString();
      // dict punctuation
      case 0x3E: // '>'
        ch = this.nextChar();
        if (ch === 0x3E) {
          this.nextChar();
          return Cmd.get('>>');
        }
        return Cmd.get('>');
      case 0x7B: // '{'
        this.nextChar();
        return Cmd.get('{');
      case 0x7D: // '}'
        this.nextChar();
        return Cmd.get('}');
      case 0x29: // ')'
        throw new Error('Illegal character: ' + ch);
    }

    // command
    var str = String.fromCharCode(ch);
    var knownCommands = this.knownCommands;
    var knownCommandFound = knownCommands && (str in knownCommands);
    while ((ch = this.nextChar()) >= 0 && !Lexer.specialChars[ch]) {
      // stop if known command is found and next character does not make
      // the str a command
      var possibleCommand = str + String.fromCharCode(ch);
      if (knownCommandFound && !(possibleCommand in knownCommands)) {
        break;
      }

      if (str.length == 128)
        throw new Error('Command token too long: ' + str.length);
      str = possibleCommand;
      knownCommandFound = knownCommands && (str in knownCommands);
    }
    if (str == 'true')
      return true;
    if (str == 'false')
      return false;
    if (str == 'null')
      return null;
    return Cmd.get(str);
  }

  skipToNextLine () {
    let ch = this.currentChar;

    while (ch >= 0) {
      if (ch === 0x0D) { // CR
        ch = this.nextChar();
        if (ch === 0x0A) { // LF
          this.nextChar();
        }
        break;
      }
      else if (ch === 0x0A) { // LF
        this.nextChar();
        break;
      }

      ch = this.nextChar();
    }
  }
}

class Linearization {
  constructor (stream) {
    this.parser = new Parser(new Lexer(stream), false, null);
    const obj1 = this.parser.getObj();
    const obj2 = this.parser.getObj();
    const obj3 = this.parser.getObj();
    this.linDict = this.parser.getObj();
    
    if (isInt(obj1) && isInt(obj2) && isCmd(obj3, 'obj') && isDict(this.linDict)) {
      const obj = this.linDict.get('Linearized');
      if (!(isNum(obj) && obj > 0)) {
        this.linDict = null;
      }
    }
  }
}
