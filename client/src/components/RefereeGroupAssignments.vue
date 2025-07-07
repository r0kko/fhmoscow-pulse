<script setup>
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api.js';

const judges = ref([]);
const groups = ref([]);
const loading = ref(false);
const error = ref('');

async function loadJudges() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiFetch('/referee-group-users');
    judges.value = data.judges.map((j) => ({
      ...j,
      group_id: j.group ? j.group.id : ''
    }));
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadGroups() {
  try {
    const params = new URLSearchParams({ page: 1, limit: 100 });
    const data = await apiFetch(`/referee-groups?${params}`);
    groups.value = data.groups;
  } catch (_) {
    groups.value = [];
  }
}

async function setGroup(judge) {
  try {
    if (!judge.group_id) {
      await apiFetch(`/referee-group-users/${judge.user.id}`, {
        method: 'DELETE'
      });
    } else {
      await apiFetch(`/referee-group-users/${judge.user.id}`, {
        method: 'POST',
        body: JSON.stringify({ group_id: judge.group_id })
      });
    }
  } catch (e) {
    alert(e.message);
  }
}

function formatName(u) {
  return `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim();
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

onMounted(() => {
  loadJudges();
  loadGroups();
});

const refresh = () => {
  loadJudges();
  loadGroups();
};

defineExpose({ refresh });
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="loading" class="text-center my-3">
      <div class="spinner-border" role="status"></div>
    </div>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="h5 mb-0">Назначение судей</h2>
      </div>
      <div class="card-body p-3">
        <div v-if="judges.length" class="table-responsive d-none d-sm-block">
          <table class="table admin-table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Дата рождения</th>
                <th>Группа</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in judges" :key="j.user.id">
                <td>{{ formatName(j.user) }}</td>
                <td>{{ formatDate(j.user.birth_date) }}</td>
                <td>
                  <select v-model="j.group_id" class="form-select" @change="setGroup(j)">
                    <option value="">Без группы</option>
                    <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="judges.length" class="d-block d-sm-none">
          <div v-for="j in judges" :key="j.user.id" class="card training-card mb-2">
            <div class="card-body p-2">
              <p class="mb-1 fw-semibold">{{ formatName(j.user) }}</p>
              <p class="mb-1 text-muted">{{ formatDate(j.user.birth_date) }}</p>
              <select v-model="j.group_id" class="form-select mt-1" @change="setGroup(j)">
                <option value="">Без группы</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>
          </div>
        </div>
        <p v-else class="text-muted mb-0">Судьи не найдены.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.training-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
