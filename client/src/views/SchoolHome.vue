<script setup>
import { onMounted, ref } from 'vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import MenuTile from '../components/MenuTile.vue';
import { apiFetch } from '../api';
import { isSportSchoolManagerPosition } from '../utils/sportSchoolPositions';

const canManageStaff = ref(false);

onMounted(checkManagerAccess);

async function checkManagerAccess() {
  try {
    const data = await apiFetch('/users/me/sport-schools');
    const clubs = Array.isArray(data?.clubs) ? data.clubs : [];
    canManageStaff.value = clubs.some((club) =>
      isSportSchoolManagerPosition(club?.sport_school_position_alias)
    );
  } catch {
    canManageStaff.value = false;
  }
}
</script>

<template>
  <div class="py-3 school-home-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
        ]"
      />
      <h1 class="mb-3">Управление спортивной школой</h1>

      <div class="card section-card tile fade-in shadow-sm mb-2">
        <div class="card-body">
          <h2 class="h5 mb-3">Разделы</h2>
          <div class="d-flex gap-2 flex-wrap">
            <MenuTile
              title="Матчи"
              icon="bi-calendar-event"
              to="/school-matches"
              :replace="true"
            />
            <MenuTile
              title="Прошедшие матчи"
              icon="bi-clock-history"
              to="/school-matches/past"
              :replace="true"
            />
            <MenuTile
              title="Команды и составы"
              icon="bi-people"
              to="/school-players"
              :replace="true"
            />
            <MenuTile
              title="Стадионы"
              icon="bi-geo-alt"
              to="/school-grounds"
              :replace="true"
            />
            <MenuTile
              v-if="canManageStaff"
              title="Сотрудники и доступы"
              icon="bi-people-gear"
              to="/school-staff"
              :replace="true"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* no extra styles */
</style>
