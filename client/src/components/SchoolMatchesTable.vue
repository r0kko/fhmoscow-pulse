<script setup>
import { formatMskTimeShort, formatMskDateLong } from '../utils/time';

const props = defineProps({
  items: { type: Array, default: () => [] },
});

function formatDate(d) {
  // Compact date for table: DD.MM.YYYY, HH:mm
  // Use long date then condense by removing weekday.
  const long = formatMskDateLong(d); // e.g., Понедельник, 02 сентября
  const date = long.replace(/^[^,]+,\s*/, '');
  const time = formatMskTimeShort(d, { placeholder: '—:—' });
  return `${date}, ${time}`;
}
</script>

<template>
  <div v-if="items.length" class="table-responsive">
    <table class="table align-middle">
      <thead>
        <tr>
          <th scope="col">Дата и время</th>
          <th scope="col">Стадион</th>
          <th scope="col">Команды</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in items" :key="m.id">
          <td>{{ formatDate(m.date) }}</td>
          <td>{{ m.stadium || '—' }}</td>
          <td>{{ m.team1 }} — {{ m.team2 }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped></style>
