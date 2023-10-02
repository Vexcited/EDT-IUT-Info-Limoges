import { type APIEvent } from "solid-start";

export const GET = async ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  const response = await fetch(url, { method: "GET" });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", "inline; filename=\"" + params.file_name + "\"");
  headers.set("Content-Length", response.headers.get("Content-Length")!);
  headers.set("Cache-Control", "public, max-age=604800, immutable");
  headers.set("Expires", new Date(Date.now() + 604800000).toUTCString());
  headers.set("Last-Modified", response.headers.get("Last-Modified")!);
  headers.set("ETag", response.headers.get("ETag")!);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,

    headers
  });
};
