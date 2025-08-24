<script setup>
import { computed } from 'vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
});

const rows = computed(() => props.items || []);
</script>

<template>
  <div class="table-responsive">
    <table class="table align-middle">
      <thead>
        <tr>
          <th style="width: 44px">#</th>
          <th style="width: 64px">№</th>
          <th>ФИО</th>
          <th class="d-none d-md-table-cell">Дата рождения</th>
          <th class="d-none d-lg-table-cell">Клубы</th>
          <th class="d-none d-lg-table-cell">Команды</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(p, idx) in rows" :key="p.id">
          <td>{{ idx + 1 }}</td>
          <td>{{ p.jersey_number ?? '-' }}</td>
          <td>{{ p.full_name || '-' }}</td>
          <td class="d-none d-md-table-cell">
            {{
              p.date_of_birth
                ? new Date(p.date_of_birth).toLocaleDateString('ru-RU')
                : '-'
            }}
          </td>
          <td class="d-none d-lg-table-cell">
            <span v-if="!p.clubs || !p.clubs.length">-</span>
            <span
              v-for="c in p.clubs"
              v-else
              :key="c.id"
              class="badge text-bg-light me-1"
              >{{ c.name }}</span
            >
          </td>
          <td class="d-none d-lg-table-cell">
            <span v-if="!p.teams || !p.teams.length">-</span>
            <span
              v-for="t in p.teams"
              v-else
              :key="t.id"
              class="badge text-bg-light me-1"
              >{{ t.name }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table {
  margin-bottom: 0;
}
</style>
