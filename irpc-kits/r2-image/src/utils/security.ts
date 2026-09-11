/**
 * Validates request Origin or Referer headers against an allowed origins whitelist.
 *
 * @param request Incoming HTTP request
 * @param allowedOrigins Comma-separated list of allowed origins (e.g. 'https://app.example.com')
 * @returns True if request origin is authorized or unconstrained
 */
export function isOriginAllowed(request: Request, allowedOrigins?: string): boolean {
  if (!allowedOrigins || allowedOrigins.trim() === '' || allowedOrigins === '*') {
    return true;
  }

  const whitelist = allowedOrigins
    .split(',')
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  const origin = request.headers.get('origin')?.toLowerCase();
  if (origin && whitelist.includes(origin)) {
    return true;
  }

  const referer = request.headers.get('referer')?.toLowerCase();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin.toLowerCase();
      if (whitelist.includes(refererOrigin)) {
        return true;
      }
    } catch {
      // Invalid referer URL, ignore and proceed to sec-fetch-site check
    }
  }

  // Allow direct address-bar browser navigation (Sec-Fetch-Site: none)
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'none' && !origin && !referer) {
    return true;
  }

  return false;
}

/**
 * Generates standard CORS preflight response headers.
 *
 * @param request Incoming OPTIONS preflight request
 * @param allowedOrigins Whitelist of allowed origins
 * @returns 204 No Content response with CORS headers
 */
export function handleCorsPreflight(request: Request, allowedOrigins?: string): Response {
  const origin = request.headers.get('origin') || '*';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  /* istanbul ignore else */
  if (isOriginAllowed(request, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return new Response(null, { status: 204, headers });
}
