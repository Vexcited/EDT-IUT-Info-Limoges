const fs = require("node:fs");

const files = [
  'shared/util.js',
  'shared/colorspace.js',
  'shared/pattern.js',
  'shared/function.js',

  'core/core.js',
  'core/obj.js',
  'core/crypto.js',
  'core/evaluator.js',
  'core/fonts.js',
  'core/glyphlist.js',
  'core/metrics.js',
  'core/parser.js',
  'core/stream.js',
  'core/worker.js',
  'core/bidi.js',
  'core/pdf_manager.js',
  'core/cmap.js',
  'core/cidmaps.js',

  'display/canvas.js',
  'display/font_loader.js',
  'display/metadata.js',
  'display/api.js'
];

let PDF_JS_CODE = "";
for (let i = 0; i < files.length; i++) {
  const path = __dirname + "/pdfjs/" + files[i];
  PDF_JS_CODE += fs.readFileSync(path, "utf8");
}

const output = `export const code = Buffer.from("${Buffer.from(PDF_JS_CODE).toString("base64")}", "base64").toString("utf8");`;
fs.writeFileSync(__dirname + "/../src/converter/pdfjs_bundle.ts", output);
