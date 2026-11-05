import { describe, expect, it, vi } from "vitest";
import { NtaCorporationProvider, UnconfiguredCorporationProvider } from "../src/providers/nta.js";

const record = `<corporation>
  <corporateNumber>1234567890123</corporateNumber><name>Ａ＆Ｂ株式会社</name>
  <furigana>エーアンドビー</furigana><postCode>0600001</postCode>
  <prefectureName>北海道</prefectureName><cityName>札幌市中央区</cityName>
  <streetNumber>北一条西１丁目</streetNumber><closeDate/>
  <updateDate>2026-01-01</updateDate>
</corporation>`;
function envelope(records = record, count = "1") {
  return `<?xml version="1.0" encoding="UTF-8"?><corporations>
    <lastUpdateDate>2026-01-01</lastUpdateDate><count>${count}</count>
    <divideNumber>1</divideNumber><divideSize>1</divideSize>${records}</corporations>`;
}
function setup(body = envelope(), status = 200) {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  return { fetchMock, provider: new NtaCorporationProvider("test-secret", fetchMock as typeof fetch) };
}

describe("NtaCorporationProvider", () => {
  it("reads XML and searches current records across all corporation kinds", async () => {
    const { provider, fetchMock } = setup(envelope(record + record, "2"));
    const results = await provider.search("A&B ｶﾌﾞ 123", 1);
    expect(results).toEqual([{
      corporateNumber: "1234567890123", name: "Ａ＆Ｂ株式会社", nameKana: "エーアンドビー",
      postalCode: "0600001", prefecture: "北海道", city: "札幌市中央区",
      street: "北一条西１丁目", status: "active", sourceUpdatedAt: "2026-01-01"
    }]);
    const [url, options] = (fetchMock.mock.calls as unknown as Parameters<typeof fetch>[])[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/4/name");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      id: "test-secret", name: "Ａ＆Ｂ　カブ　１２３", type: "12", mode: "2", target: "1", change: "0", close: "0"
    });
    expect(options).toMatchObject({ headers: { accept: "application/xml" }, redirect: "error" });
    expect(JSON.stringify(results)).not.toContain("test-secret");
  });

  it("reads a single result, empty fields and XML entities by number", async () => {
    const { provider, fetchMock } = setup(envelope(record
      .replace("Ａ＆Ｂ株式会社", "A&amp;B &lt;会社&gt;")
      .replace("<furigana>エーアンドビー</furigana>", "<furigana/>")
      .replace("<closeDate/>", "<closeDate>2025-01-01</closeDate>")));
    expect(await provider.findByNumber("1234567890123")).toMatchObject({
      name: "A&B <会社>", nameKana: null, status: "closed"
    });
    const url = new URL(String((fetchMock.mock.calls as unknown as Parameters<typeof fetch>[])[0]![0]));
    expect(url.pathname).toBe("/4/num");
    expect(url.searchParams.get("history")).toBe("0");
    expect(url.searchParams.get("number")).toBe("1234567890123");
  });

  it("handles a valid zero-result XML response", async () => {
    const { provider } = setup(envelope("", "0"));
    await expect(provider.search("該当なし", 10)).resolves.toEqual([]);
    await expect(provider.findByNumber("1234567890123")).resolves.toBeNull();
  });

  it.each([
    "{}", "<html>maintenance</html>", "<corporations>",
    '<corporations><count>1</count></corporations>',
    envelope(record.replace("1234567890123", "invalid")),
    envelope(record.replace("<name>Ａ＆Ｂ株式会社</name>", "<name><nested>bad</nested></name>")),
    '<!DOCTYPE corporations [<!ENTITY secret "test-secret">]>' + envelope(),
    '001,"test-secret"'
  ])("rejects malformed upstream data without exposing it (%#)", async (body) => {
    const { provider } = setup(body);
    await expect(provider.search("ABC", 10)).rejects.toMatchObject({ statusCode: 502, code: "UPSTREAM_ERROR" });
    try { await provider.search("ABC", 10); } catch (error) {
      expect(String(error)).not.toContain("test-secret");
      expect(JSON.stringify(error)).not.toContain(body);
    }
  });

  it("sanitizes HTTP and network errors", async () => {
    await expect(setup("test-secret", 500).provider.search("ABC", 10))
      .rejects.toMatchObject({ statusCode: 502, code: "UPSTREAM_ERROR" });
    const provider = new NtaCorporationProvider("test-secret", vi.fn(async () => {
      throw new TypeError("https://upstream/?id=test-secret");
    }) as typeof fetch);
    await expect(provider.search("ABC", 10)).rejects.toMatchObject({
      statusCode: 503, code: "UPSTREAM_UNAVAILABLE"
    });
    try { await provider.search("ABC", 10); } catch (error) {
      expect(String(error)).not.toContain("test-secret");
      expect(JSON.stringify(error)).not.toContain("test-secret");
    }
  });
});

describe("UnconfiguredCorporationProvider", () => {
  it("explains missing server-side configuration", async () => {
    await expect(new UnconfiguredCorporationProvider().search()).rejects.toMatchObject({
      statusCode: 503, code: "CORPORATION_PROVIDER_NOT_CONFIGURED"
    });
  });
});
