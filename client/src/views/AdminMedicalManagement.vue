<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import AdminMedicalCertificates from './AdminMedicalCertificates.vue';
import AdminMedicalCenters from './AdminMedicalCenters.vue';
import AdminMedicalExams from './AdminMedicalExams.vue';

const activeTab = ref('certificates');
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Медицина</li>
      </ol>
    </nav>
    <div class="card tile mb-4">
      <div class="card-body p-2">
        <ul class="nav nav-tabs mb-0">
          <li class="nav-item">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'certificates' }"
              @click="activeTab = 'certificates'"
            >
              Медицинские справки
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'centers' }"
              @click="activeTab = 'centers'"
            >
              Медицинские центры
            </button>
          </li>
          <li class="nav-item">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'exams' }"
              @click="activeTab = 'exams'"
            >
              Расписание медосмотров
            </button>
          </li>
        </ul>
      </div>
    </div>
    <div v-if="activeTab === 'certificates'">
      <AdminMedicalCertificates />
    </div>
    <div v-else-if="activeTab === 'centers'">
      <AdminMedicalCenters />
    </div>
    <div v-else>
      <AdminMedicalExams />
    </div>
  </div>
</template>
