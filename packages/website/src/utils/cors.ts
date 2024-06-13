import { json } from "solid-start/api";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

export const jsonWithCors = (data: unknown, status: number) => {
  return json(data, {
    status: status,
    headers
  });
};
