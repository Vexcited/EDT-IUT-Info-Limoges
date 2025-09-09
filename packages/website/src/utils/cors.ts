const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

export const jsonWithCors = (data: unknown, status: number) => {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
};
