export interface HeaderOptions {
  isDev: boolean;
  /** Extra origins the browser may call, e.g. the object-storage endpoint for direct uploads. */
  connectSrc?: string[];
  /** Extra image origins, e.g. the media CDN. */
  imgSrc?: string[];
}

/**
 * Baseline security headers. V0.1a has no dynamic third-party scripts, so CSP uses 'unsafe-inline'
 * for Next's inline bootstrap scripts; switch to nonces when dynamic scripts arrive.
 */
export function securityHeaders({ isDev, connectSrc = [], imgSrc = [] }: HeaderOptions): { key: string; value: string }[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${["'self'", "data:", "blob:", ...imgSrc].join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${["'self'", ...connectSrc, ...(isDev ? ["ws:"] : [])].join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
