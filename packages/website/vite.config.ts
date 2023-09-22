import solid from "solid-start/vite";
import unocss from 'unocss/vite'

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

    unocss()
  ]
});
