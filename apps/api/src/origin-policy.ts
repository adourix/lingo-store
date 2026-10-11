const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function posMutationOriginError(
  method: string,
  path: string,
  origin: string,
  configuredPosOrigin: string,
  fetchSite: string,
): "POS_BROWSER_ORIGIN_FORBIDDEN" | "CROSS_SITE_FORBIDDEN" | null {
  if (!mutatingMethods.has(method.toUpperCase()) || !path.startsWith("/api/pos/")) return null;
  if (fetchSite === "cross-site") return "CROSS_SITE_FORBIDDEN";

  if (origin) {
    if (origin !== configuredPosOrigin) return "POS_BROWSER_ORIGIN_FORBIDDEN";
  } else {
    return "POS_BROWSER_ORIGIN_FORBIDDEN";
  }
  return null;
}
