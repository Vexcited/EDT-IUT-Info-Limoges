// @refresh reload
import "@unocss/reset/tailwind.css";
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import "virtual:uno.css";

import { type Component, Suspense, createEffect } from "solid-js";

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

import {
  DEFAULT_USER_CUSTOMIZATION,
  preferences
} from "./stores/preferences";

const Root: Component = () => {
  // TODO: Should be configurable in the future.
  const FONT_FAMILY = "'Poppins', sans-serif";

  createEffect(() => {
    const root = document.querySelector(':root') as HTMLElement;
    root.style.setProperty('--custom-color', preferences.customization.primary_color ?? DEFAULT_USER_CUSTOMIZATION.primary_color);
  });

  return (
    <Html lang="fr">
      <Head>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <Meta name="color-scheme" content="dark light" data-sm />
        <Title>EDT - IUT Informatique de Limoges</Title>
        <Link rel="icon" href="/favicon.ico" />
      </Head>
      <Body class="bg-[rgb(18,18,18)] a" style={{ "font-family": FONT_FAMILY }}>
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
