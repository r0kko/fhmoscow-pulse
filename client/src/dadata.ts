import { apiFetch, type ApiFetchOptions } from './api';

type Nullable<T> = T | null | undefined;

type SuggestPart = 'SURNAME' | 'NAME' | 'PATRONYMIC';

type FmsFilter = string;
interface DadataRequestOptions {
  signal?: AbortSignal;
}

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
const DADATA_FAILURE_THRESHOLD = 3;
const DADATA_CIRCUIT_OPEN_MS = 60_000;
let dadataConsecutiveFailures = 0;
let dadataCircuitOpenedUntil = 0;

export function resetDadataRuntimeForTests(): void {
  dadataConsecutiveFailures = 0;
  dadataCircuitOpenedUntil = 0;
}

function hasQuery(value: Nullable<string>): value is string {
  return Boolean(value && value.trim());
}

async function postJson<TResponse>(
  endpoint: string,
  payload: Record<string, unknown>,
  options: DadataRequestOptions = {}
): Promise<TResponse> {
  if (Date.now() < dadataCircuitOpenedUntil) {
    throw new Error('dadata_circuit_open');
  }
  try {
    const requestOptions: ApiFetchOptions = {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: options.signal ?? null,
      redirectOn401: false,
      retryOn401: false,
    };
    const response = await apiFetch<TResponse>(endpoint, requestOptions);
    dadataConsecutiveFailures = 0;
    return response;
  } catch (err) {
    dadataConsecutiveFailures += 1;
    if (dadataConsecutiveFailures >= DADATA_FAILURE_THRESHOLD) {
      dadataCircuitOpenedUntil = Date.now() + DADATA_CIRCUIT_OPEN_MS;
      dadataConsecutiveFailures = 0;
    }
    throw err;
  }
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
  parts: SuggestPart[] = [],
  options: DadataRequestOptions = {}
): Promise<FioSuggestion[]> {
  if (!hasQuery(query)) return SUGGESTION_FALLBACK;
  try {
    const body: Record<string, unknown> = { query: query.trim() };
    if (parts.length) body['parts'] = parts;
    const { suggestions = SUGGESTION_FALLBACK } = await postJson<
      DadataSuggestResponse<FioSuggestionData>
    >('/dadata/suggest-fio', body, options);
    return suggestions;
  } catch {
    return SUGGESTION_FALLBACK;
  }
}

export async function cleanFio(
  fio: Nullable<string>,
  options: DadataRequestOptions = {}
): Promise<CleanFioResult | null> {
  if (!hasQuery(fio)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanFioResult>>(
      '/dadata/clean-fio',
      { fio: fio.trim() },
      options
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
  filters: FmsFilter[] = [],
  options: DadataRequestOptions = {}
): Promise<FmsUnitSuggestion[]> {
  if (!hasQuery(query)) return SUGGESTION_FALLBACK as FmsUnitSuggestion[];
  try {
    const body: Record<string, unknown> = { query: query.trim() };
    if (filters.length) body['filters'] = filters;
    const { suggestions = [] } = await postJson<
      DadataSuggestResponse<FmsUnitData>
    >('/dadata/suggest-fms-unit', body, options);
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
  passport: Nullable<string>,
  options: DadataRequestOptions = {}
): Promise<CleanPassportResult | null> {
  if (!hasQuery(passport)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanPassportResult>>(
      '/dadata/clean-passport',
      { passport: passport.trim() },
      options
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
  query: Nullable<string>,
  options: DadataRequestOptions = {}
): Promise<AddressSuggestion[]> {
  if (!hasQuery(query)) return [];
  try {
    const { suggestions = [] } = await postJson<
      DadataSuggestResponse<AddressData>
    >('/dadata/suggest-address', { query: query.trim() }, options);
    return suggestions;
  } catch {
    return [];
  }
}

export interface CleanAddressResult extends AddressData {
  result?: string | null;
}

export async function cleanAddress(
  address: Nullable<string>,
  options: DadataRequestOptions = {}
): Promise<CleanAddressResult | null> {
  if (!hasQuery(address)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanAddressResult>>(
      '/dadata/clean-address',
      { address: address.trim() },
      options
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
  bic: Nullable<string>,
  options: DadataRequestOptions = {}
): Promise<BankSuggestion | null> {
  if (!hasQuery(bic)) return null;
  try {
    const { bank } = await postJson<{ bank: BankSuggestion | null }>(
      '/dadata/find-bank',
      { bic: bic.trim() },
      options
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
  inn: Nullable<string>,
  options: DadataRequestOptions = {}
): Promise<OrganizationSuggestion | null> {
  if (!hasQuery(inn)) return null;
  try {
    const { organization } = await postJson<{
      organization: OrganizationSuggestion | null;
    }>('/dadata/find-organization', { inn: inn.trim() }, options);
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
  vehicle: Nullable<string>,
  options: DadataRequestOptions = {}
): Promise<CleanVehicleResult | null> {
  if (!hasQuery(vehicle)) return null;
  try {
    const { result } = await postJson<DadataCleanResponse<CleanVehicleResult>>(
      '/dadata/clean-vehicle',
      { vehicle: vehicle.trim() },
      options
    );
    return result ?? null;
  } catch {
    return null;
  }
}
