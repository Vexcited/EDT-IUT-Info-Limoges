// @refresh reload
import "@unocss/reset/tailwind.css";
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';

import "./styles/themes.css";
import "virtual:uno.css";

import { type Component, Suspense } from "solid-js";

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

const Root: Component = () => {
  // TODO: Should be configurable in the future.
  const FONT_FAMILY = "'Poppins', sans-serif";

  return (
    <Html lang="fr" class="theme-catppuccin-latte">
      <Head>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
        <Meta name="color-scheme" content="dark light" data-sm />
        <Title>EDT - IUT Informatique de Limoges</Title>
        <Link rel="icon" href="/favicon.ico" />
      </Head>
      <Body
        class="min-h-screen h-full bg-white text-gray"
        style={{ "font-family": FONT_FAMILY }}
      >
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
