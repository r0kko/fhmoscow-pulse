import type {
  AdminProfileCompletion,
  AdminUserSummary,
  AdminMedicalCenter,
  AdminMedicalExam,
  UserRoleOption,
} from '../../src/types/admin';

let userSequence = 0;

export function createAdminUser(
  overrides: Partial<AdminUserSummary> = {}
): AdminUserSummary {
  userSequence += 1;
  return {
    id: overrides.id ?? `user-${userSequence}`,
    first_name: overrides.first_name ?? 'Иван',
    last_name: overrides.last_name ?? 'Иванов',
    patronymic: overrides.patronymic ?? 'Иванович',
    phone: overrides.phone ?? '79991112233',
    email: overrides.email ?? 'ivan@example.com',
    birth_date: overrides.birth_date ?? '1990-01-01',
    status: overrides.status ?? 'ACTIVE',
    status_name: overrides.status_name ?? 'Активен',
  };
}

export function createRoleOption(
  overrides: Partial<UserRoleOption> = {}
): UserRoleOption {
  return {
    id: overrides.id ?? 'role-1',
    alias: overrides.alias ?? 'ADMIN',
    name: overrides.name ?? 'Администратор',
  };
}

export function createProfileCompletion(
  overrides: Partial<AdminProfileCompletion> = {}
): AdminProfileCompletion {
  return {
    id: overrides.id ?? 'profile-1',
    first_name: overrides.first_name ?? 'Анна',
    last_name: overrides.last_name ?? 'Смирнова',
    patronymic: overrides.patronymic ?? 'Петровна',
    birth_date: overrides.birth_date ?? '1995-05-10',
    passport: overrides.passport ?? true,
    inn: overrides.inn ?? true,
    snils: overrides.snils ?? true,
    bank_account: overrides.bank_account ?? true,
    addresses: overrides.addresses ?? true,
    taxation_type: overrides.taxation_type ?? 'Самозанятый',
  };
}

export function createMedicalCenter(
  overrides: Partial<AdminMedicalCenter> = {}
): AdminMedicalCenter {
  return {
    id: overrides.id ?? 'center-1',
    name: overrides.name ?? 'Медицинский центр №1',
    inn: overrides.inn ?? '7701234567',
    address: overrides.address ?? { result: 'Москва, Тверская 1' },
    phone: overrides.phone ?? '79991234567',
    email: overrides.email ?? 'med@center.ru',
    website: overrides.website ?? 'https://center.ru',
  };
}

export function createMedicalExam(
  overrides: Partial<AdminMedicalExam> = {}
): AdminMedicalExam {
  return {
    id: overrides.id ?? 'exam-1',
    start_at: overrides.start_at ?? '2024-05-01T09:00:00+03:00',
    end_at: overrides.end_at ?? '2024-05-01T12:00:00+03:00',
    capacity: overrides.capacity ?? 25,
    center: overrides.center ?? createMedicalCenter(),
  };
}
