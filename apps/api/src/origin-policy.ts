const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function posMutationOriginError(
  method: string,
  path: string,
  origin: string,
  configuredPosOrigin: string,
  fetchSite: string,
  referer = "",
): "POS_BROWSER_ORIGIN_FORBIDDEN" | "CROSS_SITE_FORBIDDEN" | null {
  if (!mutatingMethods.has(method.toUpperCase()) || !path.startsWith("/api/pos/")) return null;
  if (fetchSite && fetchSite !== "same-origin") return "CROSS_SITE_FORBIDDEN";
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      return "POS_BROWSER_ORIGIN_FORBIDDEN";
    }
  }
  if (!configuredPosOrigin || !requestOrigin || requestOrigin !== configuredPosOrigin) {
    return "POS_BROWSER_ORIGIN_FORBIDDEN";
  }
  return null;
}
