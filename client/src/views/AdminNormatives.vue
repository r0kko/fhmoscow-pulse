<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import TabSelector from '../components/TabSelector.vue';
import AdminNormativeGroups from '../components/AdminNormativeGroups.vue';
import AdminNormativeTypes from '../components/AdminNormativeTypes.vue';
import AdminNormativeResults from '../components/AdminNormativeResults.vue';
import AdminNormativeLedger from '../components/AdminNormativeLedger.vue';

const activeTab = ref('results');
const tabs = [
  { key: 'results', label: 'Результаты' },
  { key: 'ledger', label: 'Ведомость' },
  { key: 'types', label: 'Типы' },
  { key: 'groups', label: 'Группы' },
];
</script>

<template>
  <div class="py-3 admin-normatives-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Нормативы</li>
        </ol>
      </nav>
      <h1 class="mb-3">Нормативы</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <TabSelector v-model="activeTab" :tabs="tabs" justify="between" />
        </div>
      </div>
      <div v-if="activeTab === 'results'">
        <AdminNormativeResults />
      </div>
      <div v-else-if="activeTab === 'ledger'">
        <AdminNormativeLedger />
      </div>
      <div v-else-if="activeTab === 'types'">
        <AdminNormativeTypes />
      </div>
      <div v-else>
        <AdminNormativeGroups />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Uses global .section-card and .tab-selector from brand.css */

/* Mobile spacing handled in global styles */

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
