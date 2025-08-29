<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import TabSelector from '../components/TabSelector.vue';
import AdminMedicalCertificates from './AdminMedicalCertificates.vue';
import AdminMedicalCenters from './AdminMedicalCenters.vue';
import AdminMedicalExams from './AdminMedicalExams.vue';

const activeTab = ref('certificates');
const tabs = [
  { key: 'certificates', label: 'Медицинские справки' },
  { key: 'centers', label: 'Медицинские центры' },
  { key: 'exams', label: 'Расписание медосмотров' },
];
</script>

<template>
  <div class="py-3 admin-medical-management-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Медицина</li>
        </ol>
      </nav>
      <h1 class="mb-3">Медицина</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body p-2">
          <TabSelector v-model="activeTab" :tabs="tabs" justify="between" />
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
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Uses global .section-card and .tab-selector from brand.css */

@media (max-width: 575.98px) {
  .admin-medical-management-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
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
