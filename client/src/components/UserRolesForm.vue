<script setup>
import { ref, onMounted, watch } from 'vue';
import { apiFetch } from '../api.js';

const props = defineProps({
  userId: { type: String, required: true },
  userRoles: { type: Array, default: () => [] },
});

const roles = ref([]);
const error = ref('');
const current = ref(new Set(props.userRoles));

watch(
  () => props.userRoles,
  (val) => {
    current.value = new Set(val || []);
  }
);

async function loadRoles() {
  try {
    const data = await apiFetch('/roles');
    roles.value = data.roles;
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(loadRoles);

async function toggle(role, checked) {
  try {
    if (checked) {
      await apiFetch(`/users/${props.userId}/roles/${role.alias}`, { method: 'POST' });
      current.value.add(role.alias);
    } else {
      await apiFetch(`/users/${props.userId}/roles/${role.alias}`, { method: 'DELETE' });
      current.value.delete(role.alias);
    }
    error.value = '';
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <div class="card mt-4">
    <div class="card-body">
      <h5 class="card-title mb-3">Роли</h5>
      <div v-if="roles.length">
        <div v-for="role in roles" :key="role.id" class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            :id="`role-${role.alias}`"
            :checked="current.has(role.alias)"
            @change="toggle(role, $event.target.checked)"
          />
          <label class="form-check-label" :for="`role-${role.alias}`">
            {{ role.name }}
          </label>
        </div>
      </div>
      <p v-else class="mb-0">Нет доступных ролей.</p>
      <div v-if="error" class="text-danger mt-2">{{ error }}</div>
    </div>
  </div>
</template>
