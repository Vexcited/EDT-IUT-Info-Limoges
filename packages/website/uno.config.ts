import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [
    presetUno()
  ],

  theme: {
    colors: {
      white: "var(--white)",
      gray: "var(--gray)",
      "subgray-1": "var(--subgray-1)",
      "subgray-2": "var(--subgray-2)",
    }
  }
});
