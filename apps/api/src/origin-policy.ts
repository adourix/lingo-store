const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function posMutationOriginError(
  method: string,
  path: string,
  origin: string,
  configuredPosOrigin: string,
  fetchSite: string,
): "POS_BROWSER_ORIGIN_FORBIDDEN" | "CROSS_SITE_FORBIDDEN" | null {
  if (!mutatingMethods.has(method.toUpperCase()) || !path.startsWith("/api/pos/")) return null;
  if (origin && origin !== configuredPosOrigin) return "POS_BROWSER_ORIGIN_FORBIDDEN";
  if (fetchSite === "cross-site") return "CROSS_SITE_FORBIDDEN";
  return null;
}
