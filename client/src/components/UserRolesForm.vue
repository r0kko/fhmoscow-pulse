<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { apiFetch } from '../api.js';

const props = defineProps({
  userId: { type: String, required: true },
  userRoles: { type: Array, default: () => [] },
});

const emit = defineEmits(['updated']);

const roles = ref([]);
const error = ref('');
const saving = ref(false);
const current = ref(new Set(props.userRoles));
const selected = ref(new Set(props.userRoles));

watch(
  () => props.userRoles,
  (val) => {
    current.value = new Set(val || []);
    selected.value = new Set(val || []);
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

function toggle(alias, checked) {
  if (checked) selected.value.add(alias);
  else selected.value.delete(alias);
}

const changed = computed(() => {
  if (current.value.size !== selected.value.size) return true;
  for (const r of selected.value) if (!current.value.has(r)) return true;
  return false;
});

async function save() {
  if (!changed.value) return;
  saving.value = true;
  error.value = '';
  const toAdd = [...selected.value].filter((r) => !current.value.has(r));
  const toRemove = [...current.value].filter((r) => !selected.value.has(r));
  try {
    for (const alias of toAdd) {
      await apiFetch(`/users/${props.userId}/roles/${alias}`, {
        method: 'POST',
      });
    }
    for (const alias of toRemove) {
      await apiFetch(`/users/${props.userId}/roles/${alias}`, {
        method: 'DELETE',
      });
    }
    current.value = new Set(selected.value);
    emit('updated', [...current.value]);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="card mt-4">
    <div class="card-body">
      <h2 class="card-title h5 mb-3">Роли</h2>
      <div v-if="roles.length">
        <div v-for="role in roles" :key="role.id" class="form-check">
          <input
            :id="`role-${role.alias}`"
            class="form-check-input"
            type="checkbox"
            :checked="selected.has(role.alias)"
            @change="toggle(role.alias, $event.target.checked)"
          />
          <label class="form-check-label" :for="`role-${role.alias}`">
            {{ role.name }}
          </label>
        </div>
        <button
          class="btn btn-brand mt-3"
          :disabled="saving || !changed"
          @click="save"
        >
          Сохранить
        </button>
      </div>
      <p v-else class="mb-0">Нет доступных ролей.</p>
      <div v-if="error" class="text-danger mt-2">{{ error }}</div>
    </div>
  </div>
</template>
