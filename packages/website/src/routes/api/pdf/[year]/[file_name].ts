import { type APIEvent } from "solid-start";

export const GET = async ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  const response = await fetch(url, { method: "GET" });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", "inline; filename=\"" + params.file_name + "\"");
  headers.set("Content-Length", response.headers.get("Content-Length")!);
  headers.set("Last-Modified", response.headers.get("Last-Modified")!);

  const buffer = await response.arrayBuffer();
  const uint = new Uint8Array(buffer);
  const body = uint.reduce((data, byte) => data + String.fromCharCode(byte), "");

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,

    headers
  });
};
