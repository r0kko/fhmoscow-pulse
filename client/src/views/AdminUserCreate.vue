<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch } from '../api';
import UserForm from '../components/UserForm.vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { useToast } from '../utils/toast';
import { translateError } from '../errors';
import { trackUserCreateTelemetry } from '../utils/userCreateTelemetry';

const sexes = ref([]);
const sexesLoading = ref(false);
const sexesError = ref('');
const createdUser = ref(null);
const inviteDelivery = ref(null);
const retryInviteLoading = ref(false);

const router = useRouter();

const user = ref({
  last_name: '',
  first_name: '',
  patronymic: '',
  birth_date: '',
  sex_id: '',
  phone: '',
  email: '',
});
const formRef = ref(null);
const loading = ref(false);
const { showToast } = useToast();
const knownFormFields = new Set([
  'fio',
  'last_name',
  'first_name',
  'patronymic',
  'birth_date',
  'sex_id',
  'phone',
  'email',
]);
const breadcrumbs = computed(() => [
  { label: 'Администрирование', to: '/admin' },
  { label: 'Пользователи', to: '/admin/users' },
  { label: 'Создание пользователя' },
]);
const canSubmit = computed(
  () =>
    !loading.value &&
    !sexesLoading.value &&
    !sexesError.value &&
    !createdUser.value
);
const saveDisabledReason = computed(() => {
  if (createdUser.value) {
    return 'Пользователь уже создан. Используйте повторную отправку приглашения.';
  }
  if (sexesLoading.value) {
    return 'Загружается справочник пола';
  }
  if (sexesError.value) {
    return 'Справочник пола недоступен. Сохранение временно недоступно.';
  }
  return '';
});
const deliveryAlertVariant = computed(() => {
  if (!inviteDelivery.value) return 'warning';
  return inviteDelivery.value.status === 'failed' ? 'danger' : 'success';
});
const deliveryStatusText = computed(() => {
  const delivery = inviteDelivery.value;
  if (!delivery) return '';
  if (delivery.status === 'sent') {
    return 'Приглашение отправлено на email пользователя.';
  }
  if (delivery.status === 'queued') {
    return 'Приглашение поставлено в очередь отправки.';
  }
  const reason = delivery.reason
    ? translateError(delivery.reason) || 'Не удалось отправить приглашение.'
    : 'Не удалось отправить приглашение.';
  return `${reason} Вы можете повторить отправку.`;
});

onMounted(loadSexes);

async function loadSexes() {
  sexesLoading.value = true;
  sexesError.value = '';
  try {
    const data = await apiFetch('/sexes');
    const list = Array.isArray(data?.sexes) ? data.sexes : [];
    sexes.value = list;
    if (!list.length) {
      sexesError.value = 'Справочник пола пуст. Обратитесь в поддержку.';
    }
  } catch (err) {
    sexes.value = [];
    sexesError.value = err?.message || 'Не удалось загрузить справочник пола';
  } finally {
    sexesLoading.value = false;
  }
}

function clearServerFieldErrors() {
  for (const field of knownFormFields) {
    formRef.value?.setFieldError?.(field, '');
  }
}

function extractValidationDetails(rawDetails) {
  if (Array.isArray(rawDetails)) return rawDetails;
  if (!rawDetails || typeof rawDetails !== 'object') return [];

  if (Array.isArray(rawDetails.details)) return rawDetails.details;
  if (Array.isArray(rawDetails.field_errors)) return rawDetails.field_errors;

  const numeric = Object.keys(rawDetails)
    .filter((key) => /^\d+$/.test(key))
    .map((key) => rawDetails[key]);
  return numeric.filter(Boolean);
}

function applyApiValidationErrors(err) {
  if (err?.code !== 'validation_error') return false;
  const details = extractValidationDetails(err?.details);
  if (!details.length) return false;

  let hasFieldErrors = false;
  for (const item of details) {
    const sourceField = String(item?.field || '').trim();
    if (!sourceField) continue;
    const field = sourceField === 'sex' ? 'sex_id' : sourceField;
    if (!knownFormFields.has(field)) continue;
    const code = String(item?.code || 'validation_error');
    const msg = translateError(code) || translateError('validation_error');
    formRef.value?.setFieldError?.(field, msg);
    if (!hasFieldErrors) {
      trackUserCreateTelemetry({
        event: 'user_create_validation_error',
        field,
        code,
      });
    }
    hasFieldErrors = true;
  }
  if (hasFieldErrors) {
    formRef.value?.focusFirstInvalidField?.();
  }
  return hasFieldErrors;
}

function deliverySuccessMessage(status) {
  if (status === 'queued') {
    return 'Пользователь создан. Приглашение поставлено в очередь отправки.';
  }
  return 'Пользователь создан. Доступ отправлен на email.';
}

async function save() {
  clearServerFieldErrors();
  if (!formRef.value?.validate || !formRef.value.validate()) {
    formRef.value?.focusFirstInvalidField?.();
    trackUserCreateTelemetry({
      event: 'user_create_validation_error',
      code: 'client_validation_error',
    });
    return;
  }
  if (!canSubmit.value) return;

  trackUserCreateTelemetry({ event: 'user_create_submit' });
  const payload = { ...user.value };
  loading.value = true;
  try {
    const data = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    createdUser.value = data?.user || null;
    inviteDelivery.value = data?.delivery || null;

    if (data?.delivery?.status === 'failed') {
      showToast(
        'Пользователь создан, но отправка приглашения не выполнена',
        'warning'
      );
      trackUserCreateTelemetry({
        event: 'user_create_delivery_failed',
        code: data?.delivery?.reason || 'delivery_failed',
      });
      return;
    }

    showToast(deliverySuccessMessage(data?.delivery?.status), 'success');
    await router.push(`/admin/users/${data.user.id}`);
  } catch (e) {
    if (applyApiValidationErrors(e)) return;
    const msg = e?.message || 'Ошибка при создании пользователя';
    showToast(msg, 'danger');
    const code = e?.code || '';
    if (code === 'email_exists') {
      formRef.value?.setFieldError?.('email', msg);
    } else if (code === 'phone_exists') {
      formRef.value?.setFieldError?.('phone', msg);
    } else if (code === 'user_exists') {
      formRef.value?.setFieldError?.('fio', msg);
    }
    formRef.value?.focusFirstInvalidField?.();
  } finally {
    loading.value = false;
  }
}

async function resendInvite() {
  if (!createdUser.value?.id || retryInviteLoading.value) return;
  retryInviteLoading.value = true;
  try {
    const data = await apiFetch(
      `/users/${createdUser.value.id}/invite-resend`,
      {
        method: 'POST',
      }
    );
    inviteDelivery.value = data?.delivery || null;
    if (data?.delivery?.status === 'failed') {
      showToast('Повторная отправка не удалась', 'danger');
      trackUserCreateTelemetry({
        event: 'user_create_delivery_failed',
        code: data?.delivery?.reason || 'delivery_failed',
      });
      return;
    }
    showToast(deliverySuccessMessage(data?.delivery?.status), 'success');
  } catch (err) {
    showToast(
      err?.message || 'Не удалось повторно отправить приглашение',
      'danger'
    );
  } finally {
    retryInviteLoading.value = false;
  }
}

async function goToCreatedUser() {
  if (!createdUser.value?.id) return;
  await router.push(`/admin/users/${createdUser.value.id}`);
}

async function close() {
  await router.push('/admin/users');
}
</script>

<template>
  <div class="container mt-4">
    <Breadcrumbs :items="breadcrumbs" />
    <h1 class="mb-3">Новый пользователь</h1>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-body">
        <h2 class="card-title h5 mb-3">Основные данные и контакты</h2>
        <div
          v-if="sexesError"
          class="alert alert-warning d-flex gap-2 align-items-center mb-3"
          role="alert"
        >
          <span>{{ sexesError }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="sexesLoading"
            @click="loadSexes"
          >
            Повторить
          </button>
        </div>
        <div
          v-if="createdUser && inviteDelivery"
          class="alert mb-3"
          :class="`alert-${deliveryAlertVariant}`"
          role="status"
          aria-live="polite"
        >
          <div class="fw-semibold mb-2">Пользователь создан</div>
          <div class="mb-2">{{ deliveryStatusText }}</div>
          <div class="d-flex gap-2 flex-wrap">
            <button
              v-if="inviteDelivery.status === 'failed'"
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="retryInviteLoading"
              @click="resendInvite"
            >
              <span
                v-if="retryInviteLoading"
                class="spinner-border spinner-border-sm me-2"
              ></span>
              Повторно отправить приглашение
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="goToCreatedUser"
            >
              Открыть карточку пользователя
            </button>
          </div>
        </div>
        <form novalidate @submit.prevent="save">
          <UserForm
            ref="formRef"
            v-model="user"
            :is-new="true"
            :sexes="sexes"
            :single-fio="true"
            :show-sex="true"
            :require-sex="true"
            :frame="false"
          />
          <div class="mt-3">
            <button
              type="submit"
              class="btn btn-brand me-2"
              :disabled="!canSubmit"
            >
              <span
                v-if="loading"
                class="spinner-border spinner-border-sm me-2"
              ></span>
              Сохранить
            </button>
            <button type="button" class="btn btn-secondary" @click="close">
              Отмена
            </button>
          </div>
          <small v-if="saveDisabledReason" class="text-muted d-block mt-2">{{
            saveDisabledReason
          }}</small>
        </form>
      </div>
    </div>
  </div>
</template>
