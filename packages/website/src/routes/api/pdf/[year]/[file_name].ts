import { type APIEvent } from "solid-start"
export const GET = ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  return fetch(url);
};
