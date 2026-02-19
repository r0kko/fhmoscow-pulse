import { onScopeDispose, reactive, ref } from 'vue';

import { apiFetch, type ApiError } from '../api';
import type {
  AdminUserProfileWorkspace,
  FieldError,
  ProfileSectionKey,
  ProfileSectionState,
  TaxationInfo,
} from '../types/adminUserProfile';

const SECTION_KEYS: ProfileSectionKey[] = [
  'personal',
  'passport',
  'inn',
  'snils',
  'bank_account',
  'addresses',
  'taxation',
  'roles',
  'sport_schools',
];

function createSectionState(): ProfileSectionState {
  return {
    loading: false,
    editing: false,
    dirty: false,
    saving: false,
    error: '',
    fieldErrors: [],
  };
}

function buildSectionsState(): Record<ProfileSectionKey, ProfileSectionState> {
  return SECTION_KEYS.reduce(
    (acc, section) => {
      acc[section] = createSectionState();
      return acc;
    },
    {} as Record<ProfileSectionKey, ProfileSectionState>
  );
}

function extractFieldErrors(err: unknown): FieldError[] {
  const apiError = err as ApiError & {
    details?: {
      field_errors?: FieldError[];
      validation?: Array<{ path?: string; msg?: string }>;
    };
  };

  const details = apiError?.details;
  if (Array.isArray(details?.field_errors)) {
    return details.field_errors.map((entry) => ({
      field: String(entry.field || 'unknown'),
      code: String(entry.code || 'validation_error'),
      message: String(entry.message || 'validation_error'),
    }));
  }

  if (Array.isArray(details?.validation)) {
    return details.validation.map((entry) => ({
      field: String(entry.path || 'unknown'),
      code: String(entry.msg || 'validation_error'),
      message: String(entry.msg || 'validation_error'),
    }));
  }

  return [];
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'Ошибка запроса';
}

export function useAdminUserWorkspace() {
  const workspace = ref<AdminUserProfileWorkspace | null>(null);
  const loading = ref(false);
  const error = ref('');
  const sections =
    reactive<Record<ProfileSectionKey, ProfileSectionState>>(
      buildSectionsState()
    );

  let loadAbortController: AbortController | null = null;

  function abortWorkspaceLoad(): void {
    if (loadAbortController) {
      loadAbortController.abort();
      loadAbortController = null;
    }
  }

  async function loadWorkspace(userId: string): Promise<void> {
    abortWorkspaceLoad();
    loading.value = true;
    error.value = '';

    const controller = new AbortController();
    loadAbortController = controller;

    try {
      const data = await apiFetch<AdminUserProfileWorkspace>(
        `/users/${userId}/profile-workspace`,
        { signal: controller.signal }
      );
      workspace.value = data;
      for (const section of SECTION_KEYS) {
        sections[section].loading = false;
        sections[section].error = '';
        sections[section].fieldErrors = [];
      }
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError?.code === 'timeout' || apiError?.name === 'AbortError') {
        return;
      }
      workspace.value = null;
      error.value = toErrorMessage(err);
    } finally {
      if (loadAbortController === controller) {
        loadAbortController = null;
      }
      loading.value = false;
    }
  }

  function startEdit(section: ProfileSectionKey): void {
    sections[section].editing = true;
    sections[section].dirty = false;
    sections[section].error = '';
    sections[section].fieldErrors = [];
  }

  function cancelEdit(section: ProfileSectionKey): void {
    sections[section].editing = false;
    sections[section].dirty = false;
    sections[section].saving = false;
    sections[section].error = '';
    sections[section].fieldErrors = [];
  }

  function markDirty(section: ProfileSectionKey, dirty = true): void {
    sections[section].dirty = dirty;
  }

  async function runSectionMutation<T>(
    section: ProfileSectionKey,
    mutate: () => Promise<T>
  ): Promise<T> {
    sections[section].saving = true;
    sections[section].error = '';
    sections[section].fieldErrors = [];
    try {
      const result = await mutate();
      sections[section].dirty = false;
      sections[section].editing = false;
      return result;
    } catch (err) {
      sections[section].error = toErrorMessage(err);
      sections[section].fieldErrors = extractFieldErrors(err);
      throw err;
    } finally {
      sections[section].saving = false;
    }
  }

  async function runSectionPreviewMutation<T>(
    section: ProfileSectionKey,
    mutate: () => Promise<T>
  ): Promise<T> {
    sections[section].saving = true;
    sections[section].error = '';
    sections[section].fieldErrors = [];
    try {
      return await mutate();
    } catch (err) {
      sections[section].error = toErrorMessage(err);
      sections[section].fieldErrors = extractFieldErrors(err);
      throw err;
    } finally {
      sections[section].saving = false;
    }
  }

  async function updatePersonal(
    userId: string,
    payload: Record<string, unknown>
  ) {
    return runSectionMutation('personal', async () =>
      apiFetch<{ user: AdminUserProfileWorkspace['user'] }>(
        `/users/${userId}/profile/personal`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      )
    );
  }

  async function upsertPassport(
    userId: string,
    payload: Record<string, unknown>
  ) {
    return runSectionMutation('passport', async () =>
      apiFetch<{ passport: AdminUserProfileWorkspace['profile']['passport'] }>(
        `/users/${userId}/profile/passport`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      )
    );
  }

  async function upsertInn(userId: string, number: string) {
    return runSectionMutation('inn', async () =>
      apiFetch<{ inn: AdminUserProfileWorkspace['profile']['inn'] }>(
        `/users/${userId}/profile/inn`,
        {
          method: 'PUT',
          body: JSON.stringify({ number }),
        }
      )
    );
  }

  async function upsertSnils(userId: string, number: string) {
    return runSectionMutation('snils', async () =>
      apiFetch<{ snils: AdminUserProfileWorkspace['profile']['snils'] }>(
        `/users/${userId}/profile/snils`,
        {
          method: 'PUT',
          body: JSON.stringify({ number }),
        }
      )
    );
  }

  async function upsertBankAccount(
    userId: string,
    payload: Record<string, unknown>
  ) {
    return runSectionMutation('bank_account', async () =>
      apiFetch<{
        account: AdminUserProfileWorkspace['profile']['bank_account'];
      }>(`/users/${userId}/profile/bank-account`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    );
  }

  async function upsertAddress(
    userId: string,
    type: 'REGISTRATION' | 'RESIDENCE',
    result: string
  ) {
    return runSectionMutation('addresses', async () =>
      apiFetch<{
        address: AdminUserProfileWorkspace['profile']['addresses']['REGISTRATION'];
      }>(`/users/${userId}/profile/address/${type}`, {
        method: 'PUT',
        body: JSON.stringify({ result }),
      })
    );
  }

  async function checkTaxation(
    userId: string,
    source: 'all' | 'dadata' | 'fns' = 'all'
  ) {
    return runSectionPreviewMutation('taxation', async () =>
      apiFetch<{ preview: TaxationInfo }>(
        `/users/${userId}/profile/taxation/check`,
        {
          method: 'POST',
          body: JSON.stringify({ source }),
        }
      )
    );
  }

  async function upsertTaxation(userId: string) {
    return runSectionMutation('taxation', async () =>
      apiFetch<{ taxation: AdminUserProfileWorkspace['profile']['taxation'] }>(
        `/users/${userId}/profile/taxation`,
        {
          method: 'PUT',
        }
      )
    );
  }

  async function updateRoles(userId: string, roles: string[]) {
    return runSectionMutation('roles', async () =>
      apiFetch<{ roles: Array<{ alias: string; name: string }> }>(
        `/users/${userId}/profile/roles`,
        {
          method: 'PUT',
          body: JSON.stringify({ roles }),
        }
      )
    );
  }

  async function updateSportSchools(
    userId: string,
    payload: { club_ids: string[]; team_ids: string[] }
  ) {
    return runSectionMutation('sport_schools', async () =>
      apiFetch<{
        sport_school_links: AdminUserProfileWorkspace['profile']['sport_school_links'];
      }>(`/users/${userId}/profile/sport-schools`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    );
  }

  onScopeDispose(() => {
    abortWorkspaceLoad();
  });

  return {
    workspace,
    loading,
    error,
    sections,
    loadWorkspace,
    abortWorkspaceLoad,
    startEdit,
    cancelEdit,
    markDirty,
    updatePersonal,
    upsertPassport,
    upsertInn,
    upsertSnils,
    upsertBankAccount,
    upsertAddress,
    checkTaxation,
    upsertTaxation,
    updateRoles,
    updateSportSchools,
  };
}
