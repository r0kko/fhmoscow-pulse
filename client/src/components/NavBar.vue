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
        <span v-if="currentUser" class="navbar-text me-3 d-none d-md-inline">
          {{ currentUser.last_name }} {{ currentUser.first_name }}
          {{ currentUser.patronymic }}
        </span>
        <button
          class="btn btn-outline-light d-none d-md-inline"
          type="button"
          @click="logout"
        >
          Выйти
        </button>
        <button
          class="btn btn-outline-light d-md-none"
          type="button"
          aria-label="Выйти"
          @click="logout"
        >
          <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth, fetchCurrentUser, clearAuth, type AuthUser } from '../auth';
import { apiFetch, initCsrf } from '../api';

const router = useRouter();

const currentUser = computed<AuthUser | null>(() => auth.user);

onMounted(async () => {
  if (!auth.user) {
    try {
      await fetchCurrentUser();
    } catch (error) {
      await logout();
    }
  }
});

async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    clearAuth();
  }
  await initCsrf().catch(() => {});
  await router.push('/login');
}
</script>
