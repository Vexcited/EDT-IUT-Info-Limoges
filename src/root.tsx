// @refresh reload
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
  Title
} from "solid-start";

const Root: Component = () => {
  return (
    <Html lang="fr">
      <Head>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
        <Meta name="color-scheme" content="dark light" data-sm />
        <Title>EDT - IUT Informatique de Limoges</Title>
      </Head>
      <Body>
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
