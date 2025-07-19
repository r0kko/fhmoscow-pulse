<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import AdminMedicalCertificates from './AdminMedicalCertificates.vue';
import AdminMedicalCenters from './AdminMedicalCenters.vue';
import AdminMedicalExams from './AdminMedicalExams.vue';

const activeTab = ref('certificates');
</script>

<template>
  <div class="py-3 admin-medical-management-page">
    <div class="container">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Медицина</li>
      </ol>
    </nav>
    <div class="card section-card tile fade-in shadow-sm mb-3">
      <div class="card-body p-2">
        <ul class="nav nav-pills nav-fill justify-content-between mb-0 tab-selector">
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
  </div>
</template>

<style scoped>
.tab-selector {
  gap: 0.5rem;
}

.tab-selector .nav-link {
  border-radius: 0.5rem;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

@media (max-width: 575.98px) {
  .admin-medical-management-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .admin-medical-management-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
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
