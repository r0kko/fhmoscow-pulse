import { apiFetch } from './api';

type Nullable<T> = T | null | undefined;

type SuggestPart = 'SURNAME' | 'NAME' | 'PATRONYMIC';

type FmsFilter = string;

type VehicleQualityCode = 0 | 1 | 2 | number;
export interface DadataSuggestion<T = Record<string, unknown>> {
  value: string;
  unrestricted_value?: string | null;
  data?: T;
}

interface DadataSuggestResponse<T = Record<string, unknown>> {
  suggestions?: DadataSuggestion<T>[];
}

interface DadataCleanResponse<T = Record<string, unknown>> {
  result?: T | null;
}

const SUGGESTION_FALLBACK: DadataSuggestion[] = [];

function hasQuery(value: Nullable<string>): value is string {
  return Boolean(value && value.trim());
}

async function postJson<TResponse>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<TResponse> {
  return apiFetch<TResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface FioSuggestionData {
  surname?: string;
  name?: string;
  patronymic?: string;
  gender?: string;
  qc?: number;
}

export type FioSuggestion = DadataSuggestion<FioSuggestionData>;

export type CleanFioResult = FioSuggestionData;

export async function suggestFio(
  query: Nullable<string>,
  parts: SuggestPart[] = []
): Promise<FioSuggestion[]> {
  if (!hasQuery(query)) return SUGGESTION_FALLBACK;
  try {
    const body: Record<string, unknown> = { query: query.trim() };
    if (parts.length) body['parts'] = parts;
    const { suggestions = SUGGESTION_FALLBACK } = await postJson<
      DadataSuggestResponse<FioSuggestionData>
    >('/dadata/suggest-fio', body);
    return suggestions;
  } catch {
    return SUGGESTION_FALLBACK;
  }
}

export async function cleanFio(
  fio: Nullable<string>
): Promise<CleanFioResult | null> {
  if (!hasQuery(fio)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanFioResult>>(
      '/dadata/clean-fio',
      { fio: fio.trim() }
    );
    return result ?? null;
  } catch {
    return null;
  }
}

export interface FmsUnitData {
  code?: string;
  name?: string;
  region?: string;
}

export type FmsUnitSuggestion = DadataSuggestion<FmsUnitData>;

export async function suggestFmsUnit(
  query: Nullable<string>,
  filters: FmsFilter[] = []
): Promise<FmsUnitSuggestion[]> {
  if (!hasQuery(query)) return SUGGESTION_FALLBACK as FmsUnitSuggestion[];
  try {
    const body: Record<string, unknown> = { query: query.trim() };
    if (filters.length) body['filters'] = filters;
    const { suggestions = [] } = await postJson<
      DadataSuggestResponse<FmsUnitData>
    >('/dadata/suggest-fms-unit', body);
    return suggestions;
  } catch {
    return [];
  }
}

export interface CleanPassportResult {
  series: string;
  number: string;
  qc: number;
}

export async function cleanPassport(
  passport: Nullable<string>
): Promise<CleanPassportResult | null> {
  if (!hasQuery(passport)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanPassportResult>>(
      '/dadata/clean-passport',
      { passport: passport.trim() }
    );
    return result ?? null;
  } catch {
    return null;
  }
}

export interface AddressData {
  postal_code?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  street?: string | null;
  house?: string | null;
  geo_lat?: string | null;
  geo_lon?: string | null;
}

export type AddressSuggestion = DadataSuggestion<AddressData>;

export async function suggestAddress(
  query: Nullable<string>
): Promise<AddressSuggestion[]> {
  if (!hasQuery(query)) return [];
  try {
    const { suggestions = [] } = await postJson<
      DadataSuggestResponse<AddressData>
    >('/dadata/suggest-address', { query: query.trim() });
    return suggestions;
  } catch {
    return [];
  }
}

export interface CleanAddressResult extends AddressData {
  result?: string | null;
}

export async function cleanAddress(
  address: Nullable<string>
): Promise<CleanAddressResult | null> {
  if (!hasQuery(address)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanAddressResult>>(
      '/dadata/clean-address',
      { address: address.trim() }
    );
    return result ?? null;
  } catch {
    return null;
  }
}

export interface BankData {
  correspondent_account?: string | null;
  swift?: string | null;
  inn?: string | null;
  kpp?: string | null;
  address?: {
    unrestricted_value?: string | null;
  } | null;
}

export type BankSuggestion = DadataSuggestion<BankData>;

export async function findBankByBic(
  bic: Nullable<string>
): Promise<BankSuggestion | null> {
  if (!hasQuery(bic)) return null;
  try {
    const { bank } = await postJson<{ bank: BankSuggestion | null }>(
      '/dadata/find-bank',
      { bic: bic.trim() }
    );
    return bank ?? null;
  } catch {
    return null;
  }
}

export interface OrganizationData {
  inn?: string | null;
  ogrn?: string | null;
  kpp?: string | null;
  address?: AddressData;
}

export type OrganizationSuggestion = DadataSuggestion<OrganizationData>;

export async function findOrganizationByInn(
  inn: Nullable<string>
): Promise<OrganizationSuggestion | null> {
  if (!hasQuery(inn)) return null;
  try {
    const { organization } = await postJson<{
      organization: OrganizationSuggestion | null;
    }>('/dadata/find-organization', { inn: inn.trim() });
    return organization ?? null;
  } catch {
    return null;
  }
}

export interface CleanVehicleResult {
  result?: string | null;
  qc?: VehicleQualityCode;
}

export async function cleanVehicle(
  vehicle: Nullable<string>
): Promise<CleanVehicleResult | null> {
  if (!hasQuery(vehicle)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanVehicleResult>>(
      '/dadata/clean-vehicle',
      { vehicle: vehicle.trim() }
    );
    return result ?? null;
  } catch {
    return null;
  }
}
