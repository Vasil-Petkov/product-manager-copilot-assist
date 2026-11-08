export function browserHeaders(production = true) {
  const csp = [
    "default-src 'self'",
    `script-src 'self'${production ? "" : " 'unsafe-inline'"}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self'${production ? "" : " ws: wss:"}`,
    "object-src 'none'", "base-uri 'none'",
    "form-action 'self' https://replit.com",
    production ? "frame-ancestors 'none'" : "frame-ancestors 'self' https://replit.com https://*.replit.dev",
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...(production ? { "X-Frame-Options": "DENY", "Strict-Transport-Security": "max-age=63072000; includeSubDomains" } : {}),
  };
}
