<script setup>
const props = defineProps({
  items: { type: Array, default: () => [] },
});

function formatDate(d) {
  return new Date(d).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
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
