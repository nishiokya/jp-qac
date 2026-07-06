import { describe, expect, it, vi } from "vitest";
import { NtaCorporationProvider, UnconfiguredCorporationProvider } from "../src/providers/nta.js";

describe("NtaCorporationProvider", () => {
  it("builds a name-search request without exposing the ID in output data", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      corporation: [
        {
          corporateNumber: "1234567890123",
          name: "ABC株式会社",
          furigana: "エービーシーカブシキガイシャ",
          postCode: "1000001",
          prefectureName: "東京都",
          cityName: "千代田区",
          streetNumber: "千代田1",
          updateDate: "2026-01-01"
        },
        { corporateNumber: "9999999999999", name: "ABC合同会社" }
      ]
    }), { status: 200 })) as unknown as typeof fetch;
    const provider = new NtaCorporationProvider("secret-app-id", fetchMock);

    const results = await provider.search("ABC", 1);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      corporateNumber: "1234567890123",
      name: "ABC株式会社",
      status: "active"
    });
    const requestedUrl = String(vi.mocked(fetchMock).mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/4/name?");
    expect(requestedUrl).toContain("id=secret-app-id");
    expect(requestedUrl).toContain("name=ABC");
    expect(JSON.stringify(results)).not.toContain("secret-app-id");
  });

  it("maps a closed corporation returned by number", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      corporation: {
        corporateNumber: "1234567890123",
        name: "閉鎖法人",
        closeDate: "2025-01-01"
      }
    }), { status: 200 })) as unknown as typeof fetch;
    const provider = new NtaCorporationProvider("app-id", fetchMock);

    const result = await provider.findByNumber("1234567890123");

    expect(result?.status).toBe("closed");
    expect(String(vi.mocked(fetchMock).mock.calls[0]?.[0])).toContain("/4/num?");
  });

  it("returns null for an empty successful response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const provider = new NtaCorporationProvider("app-id", fetchMock);
    await expect(provider.findByNumber("1234567890123")).resolves.toBeNull();
  });

  it("converts upstream HTTP errors to a safe 502 error", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("failure", { status: 500 })) as unknown as typeof fetch;
    const provider = new NtaCorporationProvider("app-id", fetchMock);
    await expect(provider.search("ABC", 10)).rejects.toMatchObject({
      statusCode: 502,
      code: "UPSTREAM_ERROR"
    });
  });

  it("converts network failures to a safe 503 error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const provider = new NtaCorporationProvider("app-id", fetchMock);
    await expect(provider.search("ABC", 10)).rejects.toMatchObject({
      statusCode: 503,
      code: "UPSTREAM_UNAVAILABLE"
    });
  });
});

describe("UnconfiguredCorporationProvider", () => {
  it("explains the missing server-side configuration", async () => {
    const provider = new UnconfiguredCorporationProvider();
    await expect(provider.search()).rejects.toMatchObject({
      statusCode: 503,
      code: "CORPORATION_PROVIDER_NOT_CONFIGURED"
    });
  });
});
