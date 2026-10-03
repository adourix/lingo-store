export type HealthResponse = {
  ok: true;
  service: "api";
  version: string;
};

export type Surface = "public" | "admin" | "pos";
