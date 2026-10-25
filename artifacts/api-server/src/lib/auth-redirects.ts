import type { Response } from "express";

const LOCAL_ORIGIN = "https://local.invalid";
const UNSAFE_CHARACTERS = /[\\\u0000-\u0020\u007f]/;

/**
 * Return only a root-relative, same-origin path, including after URL/browser
 * normalization. Cookies are just as untrusted as query parameters.
 */
export function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || UNSAFE_CHARACTERS.test(value)) {
    return "/";
  }
  try {
    const url = new URL(value, LOCAL_ORIGIN);
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.origin !== LOCAL_ORIGIN ||
      url.pathname.startsWith("//") ||
      decodedPath.startsWith("//") ||
      UNSAFE_CHARACTERS.test(decodedPath)
    ) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/**
 * Forwarded headers are not an origin allowlist. Use only hosts provisioned by
 * the server environment and always use HTTPS for OIDC callback/logout URLs.
 */
export function getTrustedAppOrigin(host: unknown, allowedHosts: readonly string[]): string {
  if (typeof host !== "string" || UNSAFE_CHARACTERS.test(host)) {
    throw new Error("Untrusted authentication origin");
  }
  const normalized = host.toLowerCase();
  if (!allowedHosts.some((allowed) => allowed.trim().toLowerCase() === normalized)) {
    throw new Error("Untrusted authentication origin");
  }
  const url = new URL(`https://${normalized}`);
  if (url.host !== normalized || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Untrusted authentication origin");
  }
  return url.origin;
}

export function redirectToLocalPath(res: Response, value: unknown): void {
  res.redirect(getSafeReturnTo(value));
}

/**
 * An OIDC redirect must target the exact HTTPS endpoint from trusted discovery
 * metadata, not a URL/host supplied by the browser. Query parameters added by
 * openid-client (state, PKCE, callback URI) are retained.
 */
export function redirectToOidcEndpoint(
  res: Response,
  target: URL,
  discoveredEndpoint: string | undefined,
): void {
  if (!discoveredEndpoint) {
    throw new Error("Missing OIDC redirect endpoint");
  }
  const endpoint = new URL(discoveredEndpoint);
  if (
    endpoint.protocol !== "https:" ||
    target.protocol !== "https:" ||
    endpoint.username || endpoint.password || endpoint.hash ||
    target.username || target.password || target.hash ||
    target.origin !== endpoint.origin ||
    target.pathname !== endpoint.pathname
  ) {
    throw new Error("Untrusted OIDC redirect endpoint");
  }
  res.redirect(target.href);
}
