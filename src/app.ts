import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { z } from "zod";
import type { Config } from "./config.js";
import { PostalRepository } from "./db.js";
import type { CorporationProvider } from "./domain/types.js";
import { normalizeCompanyName, normalizeCorporateNumber, normalizePostalCode } from "./domain/normalize.js";
import { ApiError } from "./errors.js";
import { NtaCorporationProvider, UnconfiguredCorporationProvider } from "./providers/nta.js";

interface AppOptions {
  config: Config;
  postalRepository?: PostalRepository;
  corporationProvider?: CorporationProvider;
  logger?: boolean;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { config } = options;
  const app = Fastify({
    logger: options.logger ?? config.NODE_ENV !== "test",
    requestIdHeader: "x-request-id",
    disableRequestLogging: config.NODE_ENV === "test"
  });
  const postal = options.postalRepository ?? new PostalRepository(config.databasePath);
  const corporations = options.corporationProvider ??
    (config.NTA_APPLICATION_ID
      ? new NtaCorporationProvider(config.NTA_APPLICATION_ID)
      : new UnconfiguredCorporationProvider());

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) callback(null, true);
      else callback(new ApiError(403, "ORIGIN_NOT_ALLOWED", "このオリジンからのアクセスは許可されていません"), false);
    }
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "リクエスト数が上限を超えました",
        details: { retryAfterSeconds: context.after }
      }
    })
  });
  await app.register(swagger, {
    openapi: {
      info: { title: "jp-qac API", version: "0.1.0" },
      servers: [{ url: "/" }]
    }
  });
  await app.register(swaggerUi, { routePrefix: "/documentation" });
  await app.register(staticPlugin, {
    root: join(__dirname, "../public"),
    prefix: "/demo/",
    decorateReply: false
  });

  app.get("/", async (_request, reply) => reply.redirect("/documentation"));

  app.get("/health", {
    schema: {
      tags: ["system"],
      response: { 200: { type: "object", additionalProperties: true } }
    }
  }, async () => ({
    status: "ok",
    data: { postalRecordCount: postal.count(), corporationProviderConfigured: Boolean(config.NTA_APPLICATION_ID) }
  }));

  app.get("/v1/postal-codes/:postalCode", {
    schema: {
      tags: ["postal"],
      params: {
        type: "object",
        required: ["postalCode"],
        properties: { postalCode: { type: "string", examples: ["100-0001"] } }
      }
    }
  }, async (request) => {
    const raw = (request.params as { postalCode: string }).postalCode;
    const postalCode = normalizePostalCode(raw);
    if (!postalCode) throw new ApiError(400, "INVALID_POSTAL_CODE", "郵便番号は7桁の数字で指定してください");
    const addresses = postal.findByPostalCode(postalCode);
    if (addresses.length === 0) throw new ApiError(404, "POSTAL_CODE_NOT_FOUND", "該当する住所がありません");
    return { data: addresses, meta: { count: addresses.length, normalizedPostalCode: postalCode } };
  });

  app.get("/v1/corporations", {
    schema: {
      tags: ["corporations"],
      querystring: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, async (request) => {
    const parsed = z.object({
      name: z.string().min(2).max(100),
      limit: z.coerce.number().int().min(1).max(50).default(10)
    }).parse(request.query);
    const name = normalizeCompanyName(parsed.name);
    const results = await corporations.search(name, parsed.limit);
    return { data: results, meta: { count: results.length, query: name } };
  });

  app.get("/v1/corporations/:corporateNumber", {
    schema: {
      tags: ["corporations"],
      params: {
        type: "object",
        required: ["corporateNumber"],
        properties: { corporateNumber: { type: "string" } }
      }
    }
  }, async (request) => {
    const raw = (request.params as { corporateNumber: string }).corporateNumber;
    const number = normalizeCorporateNumber(raw);
    if (!number) throw new ApiError(400, "INVALID_CORPORATE_NUMBER", "法人番号は13桁の数字で指定してください");
    const corporation = await corporations.findByNumber(number);
    if (!corporation) throw new ApiError(404, "CORPORATION_NOT_FOUND", "該当する法人がありません");
    return { data: corporation, meta: { normalizedCorporateNumber: number } };
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: "ROUTE_NOT_FOUND", message: "APIエンドポイントが見つかりません", requestId: request.id }
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const validation = typeof error === "object" && error !== null && "validation" in error
      ? (error as { validation?: unknown }).validation
      : undefined;
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details, requestId: request.id }
      });
    }
    if (error instanceof z.ZodError || validation) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "入力値が正しくありません",
          details: error instanceof z.ZodError ? z.flattenError(error).fieldErrors : validation,
          requestId: request.id
        }
      });
    }
    request.log.error(error);
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "サーバー内部でエラーが発生しました", requestId: request.id }
    });
  });

  app.addHook("onClose", async () => {
    if (!options.postalRepository) postal.close();
  });

  return app;
}
