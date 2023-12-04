import { defineConfig, presetUno, transformerVariantGroup } from "unocss";
import { presetKobalte } from "unocss-preset-primitives";

export default defineConfig({
  // @ts-expect-error : This is a custom property.
  presets: [presetUno(), presetKobalte()],
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
