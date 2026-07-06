import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { loadConfig } from "../src/config.js";
import { buildApp } from "../src/app.js";
import type { CorporationProvider } from "../src/domain/types.js";

const postalRepository = {
  count: () => 1,
  findByPostalCode: (code: string) => code === "1000001" ? [{
    postalCode: code,
    prefecture: "東京都",
    city: "千代田区",
    town: "千代田",
    prefectureKana: "トウキョウト",
    cityKana: "チヨダク",
    townKana: "チヨダ"
  }] : [],
  close: () => {}
};
const corporationProvider: CorporationProvider = {
  search: async (name) => [{
    corporateNumber: "1234567890123",
    name,
    nameKana: null,
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    street: "千代田1",
    status: "active",
    sourceUpdatedAt: null
  }],
  findByNumber: async (number) => number === "1234567890123" ? {
    corporateNumber: number,
    name: "ABC株式会社",
    nameKana: "エービーシーカブシキガイシャ",
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    street: "千代田1",
    status: "active",
    sourceUpdatedAt: "2026-01-01"
  } : null
};

let app: FastifyInstance | undefined;
afterEach(async () => app?.close());

async function makeApp() {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_PATH: ":memory:",
    ALLOWED_ORIGINS: "http://localhost:3000"
  });
  app = await buildApp({
    config,
    postalRepository: postalRepository as never,
    corporationProvider,
    logger: false
  });
  return app;
}

describe("API", () => {
  it("returns normalized postal results", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/v1/postal-codes/１００－０００１" });
    expect(response.statusCode).toBe(200);
    expect(response.json().meta.normalizedPostalCode).toBe("1000001");
  });

  it("returns a stable validation error", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/v1/postal-codes/123" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_POSTAL_CODE");
    expect(response.json().error.requestId).toBeTruthy();
  });

  it("returns 404 for an unknown postal code", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/v1/postal-codes/999-9999" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("POSTAL_CODE_NOT_FOUND");
  });

  it("normalizes company names", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/v1/corporations?name=ＡＢＣ　株式会社" });
    expect(response.statusCode).toBe(200);
    expect(response.json().meta.query).toBe("ABC 株式会社");
  });

  it.each([
    ["/v1/corporations?name=A", "VALIDATION_ERROR"],
    ["/v1/corporations?name=ABC&limit=0", "VALIDATION_ERROR"],
    ["/v1/corporations?name=ABC&limit=51", "VALIDATION_ERROR"]
  ])("rejects invalid corporation search: %s", async (url, code) => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(code);
  });

  it("normalizes and returns a corporate number lookup", async () => {
    const server = await makeApp();
    const response = await server.inject({
      method: "GET",
      url: "/v1/corporations/１２３４-５６７８-９０１２３"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.corporateNumber).toBe("1234567890123");
  });

  it("rejects an invalid corporate number", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/v1/corporations/123" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_CORPORATE_NUMBER");
  });

  it("returns 404 for an unknown corporation", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/v1/corporations/9999999999999" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("CORPORATION_NOT_FOUND");
  });

  it("returns 404 in the common error envelope for unknown routes", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/v1/unknown" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("ROUTE_NOT_FOUND");
    expect(response.json().error.requestId).toBeTruthy();
  });

  it("allows configured and same-origin requests", async () => {
    const server = await makeApp();
    const response = await server.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:3000" }
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("rejects disallowed origins", async () => {
    const server = await makeApp();
    const response = await server.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" }
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("reports dataset and provider state from health", async () => {
    const server = await makeApp();
    const response = await server.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      data: { postalRecordCount: 1, corporationProviderConfigured: false }
    });
  });
});
