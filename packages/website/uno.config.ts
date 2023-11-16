import { defineConfig, presetUno, transformerVariantGroup } from 'unocss';

export default defineConfig({
  presets: [presetUno()],
  transformers: [transformerVariantGroup()],

  theme: {
    colors: {
      red: "rgba(var(--custom-color), %alpha)"
    },

    breakpoints: {
      tablet: "768px",
      "laptop-sm": "1024px",
      "laptop-lg": "1440px",
    }
  }
});
