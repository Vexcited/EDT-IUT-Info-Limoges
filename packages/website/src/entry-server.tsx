// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />

          <link rel="icon" href="/favicon.ico" />

          <meta name="color-scheme" content="dark light" />
          <meta name="msapplication-TileColor" content="#f2f4f4" />
          <meta name="theme-color" content="#f2f4f4" />

          <title>EDT - IUT Informatique de Limoges</title>
          <meta name="title" content="EDT - IUT Informatique de Limoges" />
          <meta name="description"
            content="Une PWA simple et fonctionnelle hors-ligne à utiliser pour visualiser son emploi du temps n'importe quand de façon instantané." />
          <link rel="canonical" href="https://edt-iut-info-limoges.vercel.app" />

          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://edt-iut-info-limoges.vercel.app" />
          <meta property="og:title" content="EDT - IUT Informatique de Limoges" />
          <meta property="og:description" content="Une PWA simple et fonctionnelle hors-ligne à utiliser pour visualiser son emploi du temps n'importe quand de façon instantané." />

          <meta property="twitter:card" content="summary_large_image" />
          <meta property="twitter:url" content="https://edt-iut-info-limoges.vercel.app" />
          <meta property="twitter:title" content="EDT - IUT Informatique de Limoges" />
          <meta property="twitter:description" content="Une PWA simple et fonctionnelle hors-ligne à utiliser pour visualiser son emploi du temps n'importe quand de façon instantané." />
          {assets}
        </head>
        <body class="bg-[rgb(18,18,18)] font-[Poppins,sans-serif]">
          <noscript>Veuillez activer JavaScript pour accéder à l'application web.</noscript>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
