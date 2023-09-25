import unocss from 'unocss/vite'
import solid from "solid-start/vite";
import icons from 'unplugin-icons/vite';
import { VitePWA as pwa } from "vite-plugin-pwa";

import { defineConfig } from "vite";

// @ts-expect-error
import node from "solid-start-node";
import vercel from "solid-start-vercel";

export default defineConfig({
  plugins: [
    solid({
      ssr: false,
      // If we're building using Vercel, use the Vercel adapter.
      adapter: process.env.VERCEL ? vercel({ edge: false }) : node()
    }),

    unocss(),
    icons({ compiler: "solid" }),

    pwa({
      base: "/",
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      workbox: {
        globPatterns: [
          "**/*.{js,css,html,svg,png,woff,woff2}"
        ]
      },

      manifest: {
        name: "EDT - IUT Informatique de Limoges",
        short_name: "EDT - IUT",
        description: "Une PWA simple et fonctionnelle hors-ligne à utiliser pour visualiser son emploi du temps n'importe quand de façon instantané.",

        categories: [
          "productivity"
        ],

        icons: [
          {
            src: "/icons/default.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icons/default.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],

        start_url: "/",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait"
      }
    })
  ]
});
