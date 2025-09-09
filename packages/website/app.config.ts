import { defineConfig } from "@solidjs/start/config";

import unocss from "unocss/vite";
import icons from "unplugin-icons/vite";
import { VitePWA as pwa } from "vite-plugin-pwa";

export default defineConfig({
  ssr: false,
  server: {
    preset: "vercel"
  },
  vite: {
    plugins: [
      icons({ compiler: "solid" }),
      unocss(),
      pwa({
        base: "/",
        registerType: "prompt",
        injectRegister: "auto",

        workbox: {
          sourcemap: true,
          globPatterns: [
            "**/*.{js,css,html,svg,png,woff,woff2}"
          ],
          navigateFallbackDenylist: [
            /^\/api.*/
          ],
          additionalManifestEntries: [
            { url: "favicon.ico", revision: null },
            { url: "index.html", revision: "REV_INDEX_HTML_TO_CHANGE" }
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

          screenshots: [
            {
              src: "/screenshots/WIDE_HOME.webp",
              type: "image/webp",
              sizes: "1280x720",
              form_factor: "wide",
              label: "Page d'accueil affichée au démarrage"
            },
            {
              src: "/screenshots/WIDE_SETTINGS.webp",
              type: "image/webp",
              sizes: "1280x720",
              form_factor: "wide",
              label: "Paramètres de l'application"
            },
            {
              src: "/screenshots/NARROW_HOME.webp",
              type: "image/webp",
              sizes: "828x1792",
              form_factor: "narrow",
              label: "Page d'accueil affichée au démarrage"
            },
            {
              src: "/screenshots/NARROW_SETTINGS.webp",
              type: "image/webp",
              sizes: "828x1792",
              form_factor: "narrow",
              label: "Paramètres de l'application"
            }
          ],

          start_url: "/",
          theme_color: "#f2f4f4",
          background_color: "#f2f4f4",
          display: "standalone",
          orientation: "portrait"
        }
      })
    ],
    define: {
      __APP_COMMIT_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || "dev")
    }
  }
});
