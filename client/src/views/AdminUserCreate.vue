<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import UserForm from '../components/UserForm.vue';
import { useToast } from '../utils/toast.js';

const sexes = ref([]);

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

onMounted(() => {
  loadSexes();
});

async function loadSexes() {
  try {
    const data = await apiFetch('/sexes');
    sexes.value = data.sexes;
  } catch (_) {
    sexes.value = [];
  }
}

async function save() {
  if (!formRef.value?.validate || !formRef.value.validate()) return;
  const payload = { ...user.value };
  loading.value = true;
  try {
    const data = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Доступ отправлен на email пользователя');
    router.push(`/admin/users/${data.user.id}`);
  } catch (e) {
    const msg = e?.message || 'Ошибка при создании пользователя';
    showToast(msg);
    // Highlight specific fields when possible
    const code = e?.code || '';
    if (code === 'email_exists') {
      formRef.value?.setFieldError?.('email', msg);
      document.getElementById('email')?.focus?.();
    } else if (code === 'phone_exists') {
      formRef.value?.setFieldError?.('phone', msg);
      document.getElementById('phone')?.focus?.();
    } else if (code === 'user_exists') {
      // Duplicate by personal data — focus FIO
      if (document.getElementById('fio')) {
        document.getElementById('fio')?.focus?.();
      } else {
        document.getElementById('lastName')?.focus?.();
      }
    }
  } finally {
    loading.value = false;
  }
}

function close() {
  router.push('/admin/users');
}

// global toast via useToast()

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано');
  } catch (_err) {
    showToast('Не удалось скопировать');
  }
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item">
          <RouterLink to="/admin/users">Пользователи</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Создание</li>
      </ol>
    </nav>
    <h1 class="mb-3">Новый пользователь</h1>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-body">
        <h2 class="card-title h5 mb-3">Основные данные и контакты</h2>
        <form @submit.prevent="save">
          <UserForm
            ref="formRef"
            v-model="user"
            :is-new="true"
            :sexes="sexes"
            :single-fio="true"
            :show-sex="false"
            :require-sex="false"
            :frame="false"
          />
          <div class="mt-3">
            <button
              type="submit"
              class="btn btn-brand me-2"
              :disabled="loading"
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
        </form>
      </div>
    </div>
  </div>
</template>
