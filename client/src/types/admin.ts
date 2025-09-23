export type AdminUserStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'AWAITING_CONFIRMATION'
  | string;

export interface AdminUserSummary {
  id: string;
  first_name: string;
  last_name: string;
  patronymic?: string | null;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  status: AdminUserStatus;
  status_name: string;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
  total: number;
}

export interface UserRoleOption {
  id: string | number;
  alias: string;
  name: string;
}

export interface RolesResponse {
  roles: UserRoleOption[];
}

export interface AdminProfileCompletion {
  id: string;
  first_name: string;
  last_name: string;
  patronymic?: string | null;
  birth_date?: string | null;
  passport?: boolean;
  inn?: boolean;
  snils?: boolean;
  bank_account?: boolean;
  addresses?: boolean;
  taxation_type?: string | null;
}

export interface AdminProfileCompletionResponse {
  profiles: AdminProfileCompletion[];
}

export interface AddressSummary {
  result?: string | null;
}

export interface AdminMedicalCenter {
  id: string;
  name: string;
  inn?: string | null;
  address?: AddressSummary | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface AdminMedicalCenterListResponse {
  centers: AdminMedicalCenter[];
  total: number;
}

export interface AdminMedicalExam {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number | string;
  center?: AdminMedicalCenter | null;
}

export interface AdminMedicalExamListResponse {
  exams: AdminMedicalExam[];
  total: number;
}
