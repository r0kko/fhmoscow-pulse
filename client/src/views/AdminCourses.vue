<script setup>
import { ref, onMounted, computed } from 'vue';
import { apiFetch } from '../api.js';

const users = ref([]);
const courses = ref([]);
const selectedUser = ref(null);
const userCourses = ref([]);
const loadingUsers = ref(false);
const userLoading = ref(false);
const error = ref('');
const userError = ref('');
const newCourseId = ref('');

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const data = await apiFetch(
      '/users?role=REFEREE&role=BRIGADE_REFEREE&limit=1000'
    );
    users.value = data.users;
  } catch (e) {
    error.value = e.message;
  } finally {
    loadingUsers.value = false;
  }
}

async function loadCourses() {
  try {
    const data = await apiFetch('/courses?limit=1000');
    courses.value = data.courses;
  } catch (e) {
    error.value = e.message;
  }
}

async function selectUser(user) {
  selectedUser.value = user;
  userCourses.value = [];
  userError.value = '';
  userLoading.value = true;
  try {
    const data = await apiFetch(`/course-users/${user.id}`);
    userCourses.value = data.courses;
  } catch (e) {
    userError.value = e.message;
  } finally {
    userLoading.value = false;
  }
}

const availableCourses = computed(() =>
  courses.value.filter((c) => !userCourses.value.find((uc) => uc.id === c.id))
);

async function assignCourse() {
  if (!newCourseId.value) return;
  userLoading.value = true;
  try {
    const data = await apiFetch(`/course-users/${selectedUser.value.id}`, {
      method: 'POST',
      body: JSON.stringify({ course_id: newCourseId.value }),
    });
    userCourses.value = data.courses;
    newCourseId.value = '';
  } catch (e) {
    userError.value = e.message;
  } finally {
    userLoading.value = false;
  }
}

async function removeCourse(courseId) {
  userLoading.value = true;
  try {
    const data = await apiFetch(
      `/course-users/${selectedUser.value.id}/${courseId}`,
      { method: 'DELETE' }
    );
    userCourses.value = data.courses;
  } catch (e) {
    userError.value = e.message;
  } finally {
    userLoading.value = false;
  }
}

onMounted(() => {
  loadUsers();
  loadCourses();
});
</script>

<template>
  <div class="py-4">
    <div class="container admin-courses-page">
      <h1 class="mb-4 text-center">Управление курсами</h1>
      <div class="row">
        <div class="col-md-4 mb-3">
          <div class="card section-card h-100">
            <div class="card-body">
              <h2 class="card-title h6 mb-3">Пользователи</h2>
              <div v-if="loadingUsers" class="text-muted">Загрузка...</div>
              <div v-else-if="error" class="alert alert-danger">
                {{ error }}
              </div>
              <ul v-else class="list-group user-list">
                <li
                  v-for="u in users"
                  :key="u.id"
                  class="list-group-item list-group-item-action"
                  :class="{ active: selectedUser && selectedUser.id === u.id }"
                  @click="selectUser(u)"
                >
                  {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="col-md-8 mb-3" v-if="selectedUser">
          <div class="card section-card h-100">
            <div class="card-body">
              <h2 class="card-title h6 mb-3">
                Курсы пользователя {{ selectedUser.last_name }}
                {{ selectedUser.first_name }}
              </h2>
              <div v-if="userLoading" class="text-muted">Загрузка...</div>
              <div v-else>
                <ul class="list-group mb-3">
                  <li
                    v-for="c in userCourses"
                    :key="c.id"
                    class="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <span>{{ c.name }}</span>
                    <button
                      class="btn btn-sm btn-danger"
                      @click="removeCourse(c.id)"
                    >
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                  </li>
                  <li
                    v-if="userCourses.length === 0"
                    class="list-group-item text-muted"
                  >
                    Нет назначенных курсов
                  </li>
                </ul>
                <div class="d-flex gap-2">
                  <select
                    v-model="newCourseId"
                    class="form-select"
                    :disabled="userLoading || availableCourses.length === 0"
                  >
                    <option value="">Выберите курс</option>
                    <option
                      v-for="c in availableCourses"
                      :key="c.id"
                      :value="c.id"
                    >
                      {{ c.name }}
                    </option>
                  </select>
                  <button
                    class="btn btn-brand"
                    :disabled="userLoading || !newCourseId"
                    @click="assignCourse"
                  >
                    <span
                      v-if="userLoading"
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    Назначить
                  </button>
                </div>
                <div v-if="userError" class="alert alert-danger mt-3">
                  {{ userError }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}
.user-list {
  max-height: 60vh;
  overflow-y: auto;
}
</style>
