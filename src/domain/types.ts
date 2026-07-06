export interface Address {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  prefectureKana: string;
  cityKana: string;
  townKana: string;
}

export interface Corporation {
  corporateNumber: string;
  name: string;
  nameKana: string | null;
  postalCode: string | null;
  prefecture: string;
  city: string;
  street: string;
  status: "active" | "closed" | "unknown";
  sourceUpdatedAt: string | null;
}

export interface CorporationProvider {
  search(name: string, limit: number, signal?: AbortSignal): Promise<Corporation[]>;
  findByNumber(number: string, signal?: AbortSignal): Promise<Corporation | null>;
}
