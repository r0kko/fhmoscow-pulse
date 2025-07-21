<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import AdminNormativeGroups from '../components/AdminNormativeGroups.vue';
import AdminNormativeTypes from '../components/AdminNormativeTypes.vue';
import AdminNormativeResults from '../components/AdminNormativeResults.vue';
import AdminNormativeLedger from '../components/AdminNormativeLedger.vue';

const activeTab = ref('results');
</script>

<template>
  <div class="py-3 admin-normatives-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Нормативы</li>
        </ol>
      </nav>
      <h1 class="mb-3">Нормативы</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body p-2">
          <ul
            class="nav nav-pills nav-fill justify-content-between mb-0 tab-selector"
          >
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'results' }"
                @click="activeTab = 'results'"
              >
                Результаты
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'ledger' }"
                @click="activeTab = 'ledger'"
              >
                Ведомость
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'types' }"
                @click="activeTab = 'types'"
              >
                Типы
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'groups' }"
                @click="activeTab = 'groups'"
              >
                Группы
              </button>
            </li>
          </ul>
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
  .admin-normatives-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .admin-normatives-page nav[aria-label='breadcrumb'] {
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
