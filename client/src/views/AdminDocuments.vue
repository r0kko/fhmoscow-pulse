<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const documents = ref([]);

onMounted(async () => {
  try {
    const data = await apiFetch('/documents/admin');
    documents.value = data.documents;
  } catch (_err) {
    documents.value = [];
  }
});
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Документы</li>
      </ol>
    </nav>
    <h1 class="mb-3">Документы</h1>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-body table-responsive">
        <table class="table mb-0">
          <thead>
            <tr>
              <th>Документ</th>
              <th>Получатель</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in documents" :key="d.id">
              <td>{{ d.name }}</td>
              <td>
                {{ d.recipient.lastName }} {{ d.recipient.firstName }}
                {{ d.recipient.patronymic }}
              </td>
              <td>{{ d.status?.name }}</td>
            </tr>
            <tr v-if="!documents.length">
              <td colspan="3" class="text-center">Документы отсутствуют</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
