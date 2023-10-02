import { type APIEvent } from "solid-start";

export const GET = async ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  const response = await fetch(url);
  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,

    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": response.headers.get("Content-length") || "",
      "Last-Modified": response.headers.get("Last-Modified") || ""
    }
  });
};
