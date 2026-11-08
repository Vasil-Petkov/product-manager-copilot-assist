type Fetch = typeof globalThis.fetch;
let pending: Promise<string> | undefined;

/** Readable only by the authorized browser origin; cookie remains HttpOnly.
 * A supplied transport lets Demo exit use the real server without disabling
 * fixture isolation if the exit fails. Never cache across transport changes.
 */
export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}, transport: Fetch = globalThis.fetch): Promise<Response> {
  const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (typeof window === "undefined" || typeof window.location?.origin !== "string") return transport(input, init);
  const url = new URL(input instanceof Request ? input.url : input.toString(), window.location.origin);
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return transport(input, init);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return transport(input, init);
  const bootstrap = async () => {
    const response = await transport("/api/auth/csrf", { credentials: "include", cache: "no-store", signal: init.signal });
    if (!response.ok) throw new Error("Request verification unavailable");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("csrfToken" in data) || typeof data.csrfToken !== "string") throw new Error("Invalid verification response");
    return data.csrfToken;
  };
  // Coalesce normal first-use requests so two responses cannot race to set
  // different nonce cookies. Special (unintercepted Demo exit) transports are
  // deliberately independent of fixture promises.
  const normal = transport === globalThis.fetch;
  const promise = normal ? (pending ??= bootstrap()) : bootstrap();
  const token = await promise.finally(() => { if (normal && pending === promise) pending = undefined; });
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  headers.set("X-CSRF-Token", token);
  return transport(input, { ...init, headers, credentials: init.credentials ?? "include" });
}
