<script setup>
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api.js';

const props = defineProps({ userId: String });

const taxation = ref(null);
const error = ref('');
const loading = ref(false);

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const path = props.userId
      ? `/users/${props.userId}/taxation`
      : '/taxations/me';
    const data = await apiFetch(path);
    taxation.value = data.taxation;
  } catch (e) {
    taxation.value = null;
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="card">
    <div class="card-body">
      <h5 class="card-title mb-3">Налоговый статус</h5>
      <div v-if="loading" class="text-center py-4">
        <div class="spinner-border" role="status" aria-label="Загрузка">
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>
      <div v-else-if="taxation">
        <div class="row row-cols-1 row-cols-sm-2 g-3">
          <div class="col">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-file-earmark-text"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxType" type="text" class="form-control" :value="taxation.type?.name" readonly placeholder="Тип" />
                <label for="taxType">Тип</label>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar-check"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxCheck" type="text" class="form-control" :value="formatDate(taxation.check_date)" readonly placeholder="Проверено" />
                <label for="taxCheck">Проверено</label>
              </div>
            </div>
          </div>
          <div class="col" v-if="taxation.registration_date">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxReg" type="text" class="form-control" :value="formatDate(taxation.registration_date)" readonly placeholder="Регистрация" />
                <label for="taxReg">Регистрация</label>
              </div>
            </div>
          </div>
          <div class="col" v-if="taxation.ogrn">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-hash"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxOgrn" type="text" class="form-control" :value="taxation.ogrn" readonly placeholder="ОГРН" />
                <label for="taxOgrn">ОГРН</label>
              </div>
            </div>
          </div>
          <div class="col" v-if="taxation.okved">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-briefcase"></i></span>
              <div class="form-floating flex-grow-1">
                <input id="taxOkved" type="text" class="form-control" :value="taxation.okved" readonly placeholder="ОКВЭД" />
                <label for="taxOkved">ОКВЭД</label>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="mb-0 text-muted">{{ error || 'Информация недоступна.' }}</p>
    </div>
  </div>
</template>

