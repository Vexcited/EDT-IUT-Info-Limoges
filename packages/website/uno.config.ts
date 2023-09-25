import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [
    presetUno()
  ],

  theme: {
    colors: {
      white: "var(--white)",
      gray: "var(--gray)",
      subgray: "var(--subgray)",
      overlay: "var(--overlay)"
    }
  }
});
