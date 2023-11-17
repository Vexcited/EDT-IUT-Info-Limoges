import { type APIEvent } from "solid-start/api";
import zlib from "node:zlib";
import http from "node:http";

/**
 * Streaming decompression of proxy response
 * source: https://github.com/apache/superset/blob/9773aba522e957ed9423045ca153219638a85d2f/superset-frontend/webpack.proxy-config.js#L116
 */
function decompress<TReq extends http.IncomingMessage = http.IncomingMessage>(
  proxyRes: TReq,
  contentEncoding?: string,
): TReq | zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress {
  let _proxyRes: TReq | zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress = proxyRes;
  let decompress;

  switch (contentEncoding) {
    case 'gzip':
      decompress = zlib.createGunzip();
      break;
    case 'br':
      decompress = zlib.createBrotliDecompress();
      break;
    case 'deflate':
      decompress = zlib.createInflate();
      break;
    default:
      break;
  }

  if (decompress) {
    _proxyRes.pipe(decompress);
    _proxyRes = decompress;
  }

  return _proxyRes;
}

const makeRequestNativeHTTP = async (url: string) => {
  return new Promise<{
    headers: http.IncomingHttpHeaders;
    body: Buffer;
  }>(resolve => {
    const req = http.request(url, { method: "GET" }, (res) => {
      let buffer = Buffer.from("", "utf8");
      const proxy_res = decompress(res, res.headers["content-encoding"]);

      // Concatenate chunks
      proxy_res.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      // Resolve promise on end
      proxy_res.on("end", () => {
        resolve({
          headers: res.headers,
          body: buffer
        });
      });
    });

    req.end();
  });
}

export const GET = async ({ params }: APIEvent): Promise<Response> => {
  const url = "http://edt-iut-info.unilim.fr/edt/" + params.year + "/" + params.file_name;
  const proxied_res = await makeRequestNativeHTTP(url);

  const headers = new Headers();
  headers.set("Content-Length", Buffer.byteLength(proxied_res.body).toString());
  headers.set("Last-Modified", proxied_res.headers["last-modified"]!);
  headers.set("Content-Type", "application/pdf");
  headers.set("Connection", "Keep-Alive");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Server", "Apache");

  return new Response(proxied_res.body, { headers });
};
