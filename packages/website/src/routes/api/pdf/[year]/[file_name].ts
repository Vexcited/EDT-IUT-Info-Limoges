import { type APIEvent } from "solid-start/api";

export const GET = async ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  const response = await fetch(url, { method: "GET" });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Length", response.headers.get("Content-Length")!);
  headers.set("Last-Modified", response.headers.get("Last-Modified")!);

  const data = await response.arrayBuffer();

  return new Response(Buffer.from(data), { headers });
};