// @ts-check
// eslint-disable-next-line no-undef
module.exports = /** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */ {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "solid"
  ],
  parserOptions: {
    project: "./tsconfig.json",
    // eslint-disable-next-line no-undef
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true
    }
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:solid/typescript",
    "@unocss"
  ],
  rules: {
    "brace-style": [
      "error", "stroustrup"
    ],
    "quotes": [
      "error", "double"
    ],
    "indent": [
      "error", 2, { "SwitchCase": 1 }
    ],
    "semi": [
      "error", "always"
    ],

    "jsx-quotes": [
      "error", "prefer-double"
    ],

    "n/no-callback-literal": "off",
    "@typescript-eslint/no-extra-semi": "off"
  }
};