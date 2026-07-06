import { ApiError } from "../errors.js";
import type { Corporation, CorporationProvider } from "../domain/types.js";

const BASE_URL = "https://api.houjin-bangou.nta.go.jp/4";

type NtaCorporation = {
  corporateNumber?: string;
  name?: string;
  furigana?: string;
  postCode?: string;
  prefectureName?: string;
  cityName?: string;
  streetNumber?: string;
  closeDate?: string;
  updateDate?: string;
};

type NtaResponse = {
  corporation?: NtaCorporation | NtaCorporation[];
};

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
      name,
      type: "12",
      mode: "2",
      kind: "01",
      change: "1",
      close: "0"
    });
    const data = await this.request(`${BASE_URL}/name?${params}`, signal);
    return this.extract(data).slice(0, limit);
  }

  async findByNumber(number: string, signal?: AbortSignal): Promise<Corporation | null> {
    const params = new URLSearchParams({
      id: this.applicationId,
      number: number,
      type: "12",
      history: "0"
    });
    const data = await this.request(`${BASE_URL}/num?${params}`, signal);
    return this.extract(data)[0] ?? null;
  }

  private extract(data: NtaResponse): Corporation[] {
    const source = data.corporation;
    if (!source) return [];
    return (Array.isArray(source) ? source : [source]).map(toCorporation);
  }

  private async request(url: string, signal?: AbortSignal): Promise<NtaResponse> {
    const timeout = AbortSignal.timeout(5_000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/json", "user-agent": "jp-qac/0.1" },
        signal: combinedSignal
      });
      if (!response.ok) {
        throw new ApiError(502, "UPSTREAM_ERROR", "法人情報サービスから正常な応答がありませんでした");
      }
      return await response.json() as NtaResponse;
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
