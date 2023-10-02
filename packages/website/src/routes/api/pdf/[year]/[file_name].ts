import { type APIEvent } from "solid-start";

/**
 * This only works in development, for some reasons it breaks
 * when running on Vercel.
 * 
 * So we're using a proxy inside our vercel.json configuration instead, overwriting this.
 */
export const GET = async ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  const response = await fetch(url);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,

    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": response.headers.get("Content-length") || "",
      "Last-Modified": response.headers.get("Last-Modified") || ""
    }
  });
};
