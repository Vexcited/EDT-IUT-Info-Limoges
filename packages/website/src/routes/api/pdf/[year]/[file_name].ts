import { type APIEvent } from "solid-start";

export const GET = async ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  const response = await fetch(url);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText
  });
};
