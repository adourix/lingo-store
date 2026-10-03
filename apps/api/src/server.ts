import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

const app = Fastify({ logger: true, trustProxy: false });

await app.register(helmet);
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

app.get("/health", async () => ({
  ok: true,
  service: "api",
  version: "0.1.0"
}));

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });
