<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import AdminNormativeGroups from '../components/AdminNormativeGroups.vue';
import AdminNormativeTypes from '../components/AdminNormativeTypes.vue';
import AdminNormativeResults from '../components/AdminNormativeResults.vue';

const activeTab = ref('groups');
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Нормативы</li>
      </ol>
    </nav>
    <div class="card tile mb-4">
      <div class="card-body p-2">
        <ul class="nav nav-pills nav-fill justify-content-between mb-0">
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'groups' }" @click="activeTab = 'groups'">Группы</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'types' }" @click="activeTab = 'types'">Типы</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="{ active: activeTab === 'results' }" @click="activeTab = 'results'">Результаты</button>
          </li>
        </ul>
      </div>
    </div>
    <div v-if="activeTab === 'groups'">
      <AdminNormativeGroups />
    </div>
    <div v-else-if="activeTab === 'types'">
      <AdminNormativeTypes />
    </div>
    <div v-else>
      <AdminNormativeResults />
    </div>
  </div>
</template>
