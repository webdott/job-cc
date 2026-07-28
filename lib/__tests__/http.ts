import { NextRequest } from "next/server";

export function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}
