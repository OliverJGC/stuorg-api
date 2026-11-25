import type { Request } from "express";

export function readCookie(request: Request, name: string): string | undefined {
  const pair = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!pair) {
    return undefined;
  }

  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return undefined;
  }
}
