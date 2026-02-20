<script setup>
import { computed, onMounted, ref } from 'vue';

const loading = ref(true);
const result = ref('invalid');
const message = ref('');
const data = ref(null);

function reasonMessage(reason) {
  const r = String(reason || '')
    .trim()
    .toLowerCase();
  if (r === 'invalid_code') {
    return 'Некорректная короткая ссылка. Проверьте QR-код и повторите сканирование.';
  }
  if (r === 'not_found') {
    return 'Ссылка недействительна или устарела. Запросите актуальную копию документа.';
  }
  return 'Не удалось подтвердить подлинность документа.';
}

function messageFromResult(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'valid') return 'Подпись документа подтверждена.';
  if (normalized === 'expired') {
    return 'Срок действия QR-кода истек. Запросите актуальную копию документа.';
  }
  if (normalized === 'not_found') {
    return 'Документ не найден. Проверьте QR-код или используйте актуальную версию.';
  }
  if (normalized === 'revoked') {
    return 'Документ больше не находится в подписанном состоянии.';
  }
  if (normalized === 'mismatch') {
    return 'Данные подписи не совпадают с документом.';
  }
  return 'Не удалось подтвердить подлинность документа.';
}

function getLocationState() {
  try {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const searchParams = url.searchParams;
    const token = hashParams.get('t') || searchParams.get('t') || '';
    const reason = hashParams.get('reason') || searchParams.get('reason') || '';
    return { url, hashParams, searchParams, token, reason };
  } catch {
    return {
      url: null,
      hashParams: new URLSearchParams(),
      searchParams: new URLSearchParams(),
      token: '',
      reason: '',
    };
  }
}

function scrubTokenFromAddress(state) {
  if (!state?.url) return;
  state.searchParams.delete('t');
  state.hashParams.delete('t');
  const hash = state.hashParams.toString();
  const search = state.searchParams.toString();
  const next =
    state.url.pathname +
    (search ? `?${search}` : '') +
    (hash ? `#${hash}` : '');
  window.history.replaceState(null, '', next);
}

async function verifyDocument() {
  loading.value = true;
  data.value = null;
  result.value = 'invalid';
  message.value = '';

  const state = getLocationState();
  const token = String(state.token || '').trim();

  if (!token) {
    loading.value = false;
    result.value = 'invalid';
    message.value = reasonMessage(state.reason);
    return;
  }

  try {
    scrubTokenFromAddress(state);
    const { API_BASE } = await import('../api');
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'GET',
      headers: { 'X-Verify-Token': token },
      credentials: 'omit',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok) {
      result.value = 'valid';
      data.value = json;
      message.value = json?.message || messageFromResult('valid');
    } else {
      result.value = String(json?.result || 'invalid').toLowerCase();
      message.value =
        String(json?.message || '').trim() || messageFromResult(result.value);
    }
  } catch {
    result.value = 'invalid';
    message.value = 'Ошибка сети при проверке. Попробуйте снова позже.';
  } finally {
    loading.value = false;
  }
}

function formatDateMsk(value) {
  try {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Moscow',
    }).format(date);
  } catch {
    return '—';
  }
}

const statusClass = computed(() =>
  result.value === 'valid' ? 'alert alert-success' : 'alert alert-danger'
);

const signedAtText = computed(() => {
  if (data.value?.signature?.signedAtMsk)
    return data.value.signature.signedAtMsk;
  const formatted = formatDateMsk(data.value?.signature?.signedAt);
  return formatted === '—' ? '' : formatted;
});

onMounted(() => {
  void verifyDocument();
});
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-12 col-md-10 col-lg-8">
        <article class="card section-card tile">
          <div class="card-body p-4 p-md-5">
            <header class="mb-4">
              <h1 class="h4 mb-2">Проверка электронной подписи документа</h1>
              <p class="text-muted mb-0">
                Страница доступна без авторизации. Проверка выполняется по
                защищенному QR-коду документа.
              </p>
            </header>

            <div
              v-if="loading"
              class="d-flex align-items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <span
                class="spinner-border spinner-border-sm"
                aria-hidden="true"
              ></span>
              <span>Проверяем документ…</span>
            </div>

            <template v-else>
              <div :class="statusClass" role="status" aria-live="polite">
                {{ message }}
              </div>

              <section v-if="result === 'valid' && data" class="mt-4">
                <dl class="row mb-0">
                  <dt class="col-sm-4">Документ</dt>
                  <dd class="col-sm-8">{{ data.document?.name || '—' }}</dd>

                  <dt class="col-sm-4">Номер</dt>
                  <dd class="col-sm-8">{{ data.document?.number || '—' }}</dd>

                  <dt class="col-sm-4">Дата документа</dt>
                  <dd class="col-sm-8">
                    {{ formatDateMsk(data.document?.documentDate) }}
                  </dd>

                  <dt class="col-sm-4">Подписант</dt>
                  <dd class="col-sm-8">{{ data.signer?.fio || '—' }}</dd>

                  <dt class="col-sm-4">Вид подписи</dt>
                  <dd class="col-sm-8">{{ data.signature?.type || '—' }}</dd>

                  <template v-if="signedAtText">
                    <dt class="col-sm-4">Дата подписания</dt>
                    <dd class="col-sm-8">{{ signedAtText }}</dd>
                  </template>

                  <dt class="col-sm-4">Проверено</dt>
                  <dd class="col-sm-8">{{ formatDateMsk(data.verifiedAt) }}</dd>
                </dl>
              </section>

              <div class="mt-4 d-flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn btn-outline-brand"
                  @click="verifyDocument"
                >
                  Проверить повторно
                </button>
              </div>

              <details class="mt-4">
                <summary>Как работает проверка</summary>
                <p class="text-muted small mb-0 mt-2">
                  QR-код содержит подписанный токен. Сервер проверяет
                  целостность токена и соответствие данных подписанному
                  документу.
                </p>
              </details>
            </template>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
