import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { ApiError } from "../errors.js";
import type { Corporation, CorporationProvider } from "../domain/types.js";

const BASE_URL = "https://api.houjin-bangou.nta.go.jp/4";

// Keep identifiers and postal codes as strings, including leading zeroes.
const corporationSchema = z.object({
  corporateNumber: z.string().regex(/^\d{13}$/),
  name: z.string().min(1),
  furigana: z.string().optional(),
  postCode: z.string().optional(),
  prefectureName: z.string().optional(),
  cityName: z.string().optional(),
  streetNumber: z.string().optional(),
  closeDate: z.string().optional(),
  updateDate: z.string().optional()
});
type NtaCorporation = z.infer<typeof corporationSchema>;
const responseSchema = z.object({
  corporations: z.object({
    count: z.string().regex(/^\d+$/),
    corporation: z.array(corporationSchema).default([])
  })
});
const parser = new XMLParser({
  parseTagValue: false,
  isArray: (_name, path) => path === "corporations.corporation"
});

function invalidResponse(): ApiError {
  return new ApiError(502, "UPSTREAM_ERROR", "法人情報サービスから正常な応答がありませんでした");
}

function parseResponse(xml: string): NtaCorporation[] {
  // NTA responses do not need DTDs or custom entities. Never parse them.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw invalidResponse();
  }
  const result = responseSchema.safeParse(parser.parse(xml));
  if (!result.success) throw invalidResponse();
  const { count, corporation } = result.data.corporations;
  if ((count === "0") !== (corporation.length === 0)) throw invalidResponse();
  return corporation;
}

function toNtaName(name: string): string {
  // target=1 requires full-width characters, even after API NFKC normalization.
  return name.normalize("NFKC").replace(/[!-~]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0xfee0)).replace(/ /g, "　");
}

function toCorporation(value: NtaCorporation): Corporation {
  return {
    corporateNumber: value.corporateNumber ?? "",
    name: value.name ?? "",
    nameKana: value.furigana || null,
    postalCode: value.postCode || null,
    prefecture: value.prefectureName ?? "",
    city: value.cityName ?? "",
    street: value.streetNumber ?? "",
    status: value.closeDate ? "closed" : "active",
    sourceUpdatedAt: value.updateDate || null
  };
}

export class NtaCorporationProvider implements CorporationProvider {
  constructor(
    private readonly applicationId: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async search(name: string, limit: number, signal?: AbortSignal): Promise<Corporation[]> {
    const params = new URLSearchParams({
      id: this.applicationId,
      name: toNtaName(name),
      type: "12",
      mode: "2",
      target: "1",
      change: "0",
      close: "0"
    });
    const data = await this.request(`${BASE_URL}/name?${params}`, signal);
    return data.map(toCorporation).slice(0, limit);
  }

  async findByNumber(number: string, signal?: AbortSignal): Promise<Corporation | null> {
    const params = new URLSearchParams({
      id: this.applicationId,
      number: number,
      type: "12",
      history: "0"
    });
    const data = await this.request(`${BASE_URL}/num?${params}`, signal);
    return data[0] ? toCorporation(data[0]) : null;
  }

  private async request(url: string, signal?: AbortSignal): Promise<NtaCorporation[]> {
    const timeout = AbortSignal.timeout(5_000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/xml", "user-agent": "jp-qac/0.1" },
        redirect: "error",
        signal: combinedSignal
      });
      if (!response.ok) {
        throw new ApiError(502, "UPSTREAM_ERROR", "法人情報サービスから正常な応答がありませんでした");
      }
      const xml = await response.text();
      return parseResponse(xml);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "UPSTREAM_UNAVAILABLE", "法人情報サービスに接続できませんでした");
    }
  }
}

export class UnconfiguredCorporationProvider implements CorporationProvider {
  async search(): Promise<Corporation[]> {
    throw this.error();
  }
  async findByNumber(): Promise<Corporation | null> {
    throw this.error();
  }
  private error() {
    return new ApiError(
      503,
      "CORPORATION_PROVIDER_NOT_CONFIGURED",
      "法人検索にはNTA_APPLICATION_IDの設定が必要です"
    );
  }
}
