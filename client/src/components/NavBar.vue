<template>
  <nav class="navbar navbar-dark" style="background-color: var(--brand-color)">
    <div class="container-fluid">
      <RouterLink class="navbar-brand d-flex align-items-center gap-2" to="/">
        <!--suppress CheckImageSize -->
        <img
          src="../assets/system-logo-placeholder.png"
          alt="Логотип системы"
          height="30"
          loading="lazy"
        />
      </RouterLink>
      <div class="d-flex align-items-center ms-auto">
        <span class="navbar-text me-3 d-none d-md-inline" v-if="user">
          {{ user.last_name }} {{ user.first_name }} {{ user.patronymic }}
        </span>
        <button
          class="btn btn-outline-light d-none d-md-inline"
          @click="logout"
        >
          Выйти
        </button>
        <button class="btn btn-outline-light d-md-none" @click="logout">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth, fetchCurrentUser, clearAuth } from '../auth.js';
import { apiFetch, initCsrf } from '../api.js';

const router = useRouter();
const { user } = auth;

onMounted(async () => {
  if (!auth.user) {
    try {
      await fetchCurrentUser();
    } catch (e) {
      logout();
    }
  }
});

async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' }).finally(() => {
    clearAuth();
  });
  await initCsrf().catch(() => {});
  router.push('/login');
}
</script>
