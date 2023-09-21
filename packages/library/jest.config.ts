import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest/presets/default-esm",
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { useESM: true }
    ]
  }
};

export default config;
