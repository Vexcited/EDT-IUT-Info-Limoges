// @refresh reload
import "@unocss/reset/tailwind.css";
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import "virtual:uno.css";

import {
  type Component,
  Suspense,
  createEffect,
  onMount
} from "solid-js";

import {
  Html,
  Head,
  Body,

  ErrorBoundary,
  FileRoutes,
  Routes,
  Scripts,

  Meta,
  Link,
  Title
} from "solid-start";

import { getUserCustomizationKey } from "./stores/preferences";

import UpdaterModal from "./components/modals/Updater";
import LessonModal from "./components/modals/Lesson";

import { initializeNowRefresh } from "./stores/temporary";
import { rgbToHex } from "./utils/colors";

const Root: Component = () => {
  // TODO: Should be configurable in the future.
  const FONT_FAMILY = "'Poppins', sans-serif";

  const primaryColor = () => getUserCustomizationKey("primary_color");
  const primaryColorHEX = () => primaryColor()
    .split(",")
    .map(i => Number(i)) as [r: number, g: number, b: number];

  onMount(initializeNowRefresh);
  createEffect(() => {
    // setup the custom color from the user preferences.
    const root = document.querySelector(':root') as HTMLElement;
    root.style.setProperty('--custom-color', primaryColor());
  });

  return (
    <Html lang="fr">
      <Head>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <Meta name="color-scheme" content="dark light" />
        <Meta name="theme-color" content={rgbToHex(...primaryColorHEX())} />

        <Title>EDT - IUT Informatique de Limoges</Title>
        <Link rel="icon" href="/favicon.ico" />
      </Head>
      <Body class="bg-[rgb(18,18,18)]" style={{ "font-family": FONT_FAMILY }}>
        <UpdaterModal />
        <LessonModal />

        <Suspense>
          <ErrorBoundary>
            <Routes>
              <FileRoutes />
            </Routes>
          </ErrorBoundary>
        </Suspense>
        <Scripts />
      </Body>
    </Html>
  );
};

export default Root;
