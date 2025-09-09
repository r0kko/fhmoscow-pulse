<script setup>
import Breadcrumbs from '../components/Breadcrumbs.vue';
import MenuTile from '../components/MenuTile.vue';
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* no extra styles */
</style>
