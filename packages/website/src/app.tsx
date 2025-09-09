import "@unocss/reset/tailwind.css";
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import "virtual:uno.css";

import {
  createEffect,
  Suspense,
  onMount
} from "solid-js";

import { Meta, MetaProvider } from "@solidjs/meta";
import { Router } from "@solidjs/router";

import { getUserCustomizationKey } from "~/stores/preferences";
import { FileRoutes } from "@solidjs/start/router";

import UpdaterModal from "~/components/modals/Updater";
import LessonModal from "~/components/modals/Lesson";

import { initializeNowRefresh } from "~/stores/temporary";
import { rgbToHex } from "~/utils/colors";

export default function App() {
  const primaryColor = () => getUserCustomizationKey("primary_color");
  const primaryColorHEX = () => primaryColor()
    .split(",")
    .map(i => Number(i)) as [r: number, g: number, b: number];

  onMount(initializeNowRefresh);
  createEffect(() => {
    const root = document.querySelector(':root') as HTMLElement;
    root.style.setProperty('--custom-color', primaryColor());
  });

  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Meta name="theme-color" content={rgbToHex(...primaryColorHEX())} />

          <UpdaterModal />
          <LessonModal />

          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
