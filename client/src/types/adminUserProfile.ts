export type UserLifecycleStatus = 'ACTIVE' | 'INACTIVE' | string;

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ProfileSectionState {
  loading: boolean;
  editing: boolean;
  dirty: boolean;
  saving: boolean;
  error: string;
  fieldErrors: FieldError[];
}

export type ProfileSectionKey =
  | 'personal'
  | 'passport'
  | 'inn'
  | 'snils'
  | 'bank_account'
  | 'addresses'
  | 'taxation'
  | 'roles'
  | 'sport_schools'
  | 'vehicles';

export interface AdminUserWorkspaceUser {
  id: string;
  first_name: string;
  last_name: string;
  patronymic: string | null;
  birth_date: string | null;
  sex_id: string | null;
  sex_name: string | null;
  phone: string;
  email: string;
  status: UserLifecycleStatus;
  status_name: string;
  email_confirmed: boolean;
  roles: string[];
  role_names: string[];
}

export interface PassportInfo {
  id?: string;
  document_type: string;
  document_type_name?: string;
  country: string;
  country_name?: string;
  series: string;
  number: string;
  issue_date: string;
  valid_until: string | null;
  issuing_authority: string;
  issuing_authority_code: string;
  place_of_birth: string;
}

export interface InnInfo {
  id?: string;
  number: string;
}

export interface SnilsInfo {
  id?: string;
  number: string;
}

export interface BankAccountInfo {
  id?: string;
  number: string;
  bic: string;
  bank_name?: string;
  correspondent_account?: string | null;
  swift?: string | null;
  inn?: string | null;
  kpp?: string | null;
  address?: string | null;
}

export interface AddressInfo {
  id?: string;
  result: string;
  postal_code?: string | null;
  country?: string | null;
  region_with_type?: string | null;
  city_with_type?: string | null;
  street_with_type?: string | null;
  house?: string | null;
  flat?: string | null;
}

export interface TaxationTypeInfo {
  id: string;
  alias: string;
  name: string;
}

export interface TaxationInfo {
  id?: string;
  check_date?: string | null;
  registration_date?: string | null;
  ogrn?: string | null;
  okved?: string | null;
  type?: TaxationTypeInfo;
  statuses?: {
    dadata: number | null;
    fns: number | null;
  };
}

export interface ClubLink {
  id: string;
  name: string;
}

export interface TeamLink {
  id: string;
  name: string;
  birth_year?: number | null;
}

export interface VehicleInfo {
  id: string;
  brand: string;
  model?: string | null;
  number: string;
  is_active: boolean;
}

export interface ProfileCompleteness {
  score: number;
  missing: string[];
}

export interface AdminUserProfileWorkspace {
  user: AdminUserWorkspaceUser;
  profile: {
    passport: PassportInfo | null;
    inn: InnInfo | null;
    snils: SnilsInfo | null;
    bank_account: BankAccountInfo | null;
    addresses: {
      REGISTRATION: AddressInfo | null;
      RESIDENCE: AddressInfo | null;
    };
    taxation: TaxationInfo | null;
    vehicles: VehicleInfo[];
    sport_school_links: {
      clubs: ClubLink[];
      teams: TeamLink[];
    };
  };
  related: {
    tasks_summary: { open: number; overdue: number };
    tickets_summary: { open: number; in_progress: number };
  };
  completeness: ProfileCompleteness;
  permissions: {
    can_edit_roles: boolean;
    can_manage_links: boolean;
  };
}

export interface RolesResponse {
  roles: Array<{
    id: string;
    alias: string;
    name: string;
    group_alias?: string | null;
    group_name?: string | null;
    department_alias?: string | null;
    department_name?: string | null;
    display_order?: number | null;
  }>;
}

export interface SexesResponse {
  sexes: Array<{
    id: string;
    name: string;
    alias?: string;
  }>;
}

export interface ClubsResponse {
  clubs: Array<{
    id: string;
    name: string;
  }>;
}

export interface TeamsResponse {
  teams: Array<{
    id: string;
    name: string;
    birth_year?: number | null;
  }>;
}
