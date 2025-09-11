<script setup>
import { ref, onMounted } from 'vue';

const loading = ref(true);
const ok = ref(false);
const error = ref('');
const data = ref(null);

function getToken() {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get('t') || '';
  } catch (_) {
    return '';
  }
}

async function verify() {
  loading.value = true;
  error.value = '';
  ok.value = false;
  data.value = null;
  const t = getToken();
  if (!t) {
    error.value = 'Отсутствует параметр t';
    loading.value = false;
    return;
  }
  try {
    const api = (
      import.meta.env?.VITE_API_BASE || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const res = await fetch(`${api}/verify?t=${encodeURIComponent(t)}`, {
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      error.value = json?.error || 'Документ не подтверждён';
    } else {
      ok.value = true;
      data.value = json;
    }
  } catch (_) {
    error.value = 'Ошибка сети';
  } finally {
    loading.value = false;
  }
}

onMounted(() => verify());

function formatSignedAt(sign) {
  try {
    const str = sign?.signedAtMsk || sign?.signedAt;
    if (!str) return '—';
    // If server provided localized MSK string — trust and show as-is
    if (typeof str === 'string' && /\d{2}\.\d{2}\.\d{4}/.test(str)) {
      return str;
    }
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
      hour12: false,
    }).format(d);
  } catch {
    return '—';
  }
}
</script>

<template>
  <div class="container py-5" id="main" tabindex="-1">
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-7 col-xl-6">
        <div class="card section-card tile p-3 p-md-4">
          <div class="card-body">
            <h1 class="h4 mb-3">Проверка документа</h1>
            <p class="text-muted small mb-4">
              Отсканируйте QR‑код в документе. Эта страница подтверждает
              подлинность подписи и реквизиты документа.
            </p>
            <div v-if="loading" class="d-flex align-items-center gap-2">
              <span class="spinner-border" aria-hidden="true"></span>
              <span>Проверяем…</span>
            </div>
            <template v-else>
              <div v-if="ok && data" class="alert alert-success" role="status">
                Документ подтверждён.
              </div>
              <div v-else class="alert alert-danger" role="alert">
                Не удалось подтвердить документ:
                {{ error || 'неизвестная ошибка' }}
              </div>
              <div v-if="ok && data">
                <dl class="row mb-0">
                  <dt class="col-sm-4">Документ</dt>
                  <dd class="col-sm-8">{{ data.document?.name || '—' }}</dd>
                  <dt class="col-sm-4">Номер</dt>
                  <dd class="col-sm-8">{{ data.document?.number || '—' }}</dd>
                  <dt class="col-sm-4">Статус</dt>
                  <dd class="col-sm-8">{{ data.status }}</dd>
                  <dt class="col-sm-4">Подписант</dt>
                  <dd class="col-sm-8">{{ data.signer?.fio || '—' }}</dd>
                  <dt class="col-sm-4">Дата подписания</dt>
                  <dd class="col-sm-8">{{ formatSignedAt(data.sign) }}</dd>
                </dl>
                <hr />
                <details>
                  <summary class="mb-2">Что это?</summary>
                  <p class="text-muted small mb-0">
                    QR‑код содержит защищённую ссылку с подписью (HMAC). Сервер
                    подтверждает, что данные не изменялись и подпись принадлежит
                    указанному подписанту. Мы не показываем лишние персональные
                    данные.
                  </p>
                </details>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: var(--tile-radius, 12px);
}
</style>
