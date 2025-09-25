<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { apiFetch } from '../api';
import { FHMO_STAFF_ROLES } from '../utils/roles';

const FHMO_GROUP_ALIAS = 'FHMO_STAFF';
const FHMO_ROLE_SET = new Set(FHMO_STAFF_ROLES);

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

const fhmoEnabled = ref(false);
const fhmoDepartment = ref('');
const fhmoPosition = ref('');
const syncingFhmo = ref(false);

const roleByAlias = computed(() => {
  const map = new Map();
  for (const role of roles.value) {
    map.set(role.alias, role);
  }
  return map;
});

function extractOrder(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return Number.MAX_SAFE_INTEGER;
}

const groupedRoles = computed(() => {
  if (!roles.value.length) return [];
  const groupMap = new Map();

  for (const role of roles.value) {
    const groupKey = role.group_alias || 'ungrouped';
    let group = groupMap.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        name: role.group_name || null,
        order: extractOrder(role.display_order),
        departments: new Map(),
      };
      groupMap.set(groupKey, group);
    } else {
      group.order = Math.min(group.order, extractOrder(role.display_order));
    }

    const departmentKey = role.department_alias || `${groupKey}__default`;
    let department = group.departments.get(departmentKey);
    if (!department) {
      department = {
        key: departmentKey,
        alias: role.department_alias || null,
        name: role.department_name || null,
        order: extractOrder(role.display_order),
        roles: [],
      };
      group.departments.set(departmentKey, department);
    } else {
      department.order = Math.min(department.order, extractOrder(role.display_order));
    }

    department.roles.push(role);
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      key: group.key,
      name: group.name,
      order: group.order,
      departments: Array.from(group.departments.values())
        .map((department) => ({
          ...department,
          roles: [...department.roles].sort((a, b) => {
            const orderDiff = extractOrder(a.display_order) - extractOrder(b.display_order);
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, 'ru');
          }),
        }))
        .sort((a, b) => {
          const orderDiff = a.order - b.order;
          if (orderDiff !== 0) return orderDiff;
          return (a.name || '').localeCompare(b.name || '', 'ru');
        }),
    }))
    .sort((a, b) => {
      const orderDiff = a.order - b.order;
      if (orderDiff !== 0) return orderDiff;
      return (a.name || '').localeCompare(b.name || '', 'ru');
    });
});

const fhmoGroup = computed(() =>
  groupedRoles.value.find((group) => group.key === FHMO_GROUP_ALIAS) || null
);
const displayGroups = computed(() =>
  groupedRoles.value.filter((group) => group.key !== FHMO_GROUP_ALIAS)
);
const fhmoDepartments = computed(() => fhmoGroup.value?.departments || []);
const fhmoPositions = computed(() => {
  const dept = fhmoDepartments.value.find((item) => item.key === fhmoDepartment.value);
  return dept ? dept.roles : [];
});
const fhmoSelectionValid = computed(
  () => !fhmoEnabled.value || Boolean(fhmoPosition.value)
);

function setSelected(updater) {
  const next = new Set(selected.value);
  updater(next);
  selected.value = next;
}

function syncFhmoState() {
  if (!roles.value.length) {
    fhmoEnabled.value = false;
    fhmoDepartment.value = '';
    fhmoPosition.value = '';
    return;
  }
  const fhmoAlias = [...selected.value].find((alias) => FHMO_ROLE_SET.has(alias));
  syncingFhmo.value = true;
  if (fhmoAlias && roleByAlias.value.has(fhmoAlias)) {
    const role = roleByAlias.value.get(fhmoAlias);
    fhmoEnabled.value = true;
    fhmoDepartment.value = role.department_alias
      ? role.department_alias
      : `${FHMO_GROUP_ALIAS}__default`;
    fhmoPosition.value = fhmoAlias;
  } else {
    fhmoEnabled.value = false;
    fhmoDepartment.value = '';
    fhmoPosition.value = '';
  }
  syncingFhmo.value = false;
}

watch(
  () => props.userRoles,
  (val) => {
    current.value = new Set(val || []);
    selected.value = new Set(val || []);
    syncFhmoState();
  }
);

async function loadRoles() {
  try {
    const data = await apiFetch('/roles');
    roles.value = data.roles;
    syncFhmoState();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(loadRoles);

function toggle(alias, checked) {
  setSelected((next) => {
    if (checked) {
      if (FHMO_ROLE_SET.has(alias)) {
        FHMO_STAFF_ROLES.forEach((fhmoAlias) => next.delete(fhmoAlias));
      }
      next.add(alias);
    } else {
      next.delete(alias);
    }
  });
  if (!FHMO_ROLE_SET.has(alias)) {
    syncFhmoState();
  }
}

watch(fhmoEnabled, (enabled) => {
  if (syncingFhmo.value) return;
  if (!enabled) {
    setSelected((next) => {
      FHMO_STAFF_ROLES.forEach((alias) => next.delete(alias));
    });
    fhmoDepartment.value = '';
    fhmoPosition.value = '';
    syncFhmoState();
    return;
  }

  if (!fhmoDepartment.value) {
    fhmoDepartment.value = fhmoDepartments.value[0]?.key || '';
  }
  if (!fhmoPositions.value.length) {
    fhmoPosition.value = '';
    return;
  }
  if (!fhmoPosition.value) {
    fhmoPosition.value = fhmoPositions.value[0]?.alias || '';
  }
  if (fhmoPosition.value) {
    setSelected((next) => {
      FHMO_STAFF_ROLES.forEach((alias) => next.delete(alias));
      next.add(fhmoPosition.value);
    });
    syncFhmoState();
  }
});

watch(fhmoDepartment, () => {
  if (syncingFhmo.value || !fhmoEnabled.value) return;
  if (!fhmoPositions.value.length) {
    setSelected((next) => {
      FHMO_STAFF_ROLES.forEach((alias) => next.delete(alias));
    });
    fhmoPosition.value = '';
    return;
  }
  if (!fhmoPositions.value.some((role) => role.alias === fhmoPosition.value)) {
    fhmoPosition.value = fhmoPositions.value[0]?.alias || '';
  }
});

watch(fhmoPosition, (alias) => {
  if (syncingFhmo.value || !fhmoEnabled.value) return;
  setSelected((next) => {
    FHMO_STAFF_ROLES.forEach((fhmoAlias) => next.delete(fhmoAlias));
    if (alias) next.add(alias);
  });
});

const changed = computed(() => {
  if (current.value.size !== selected.value.size) return true;
  for (const alias of selected.value) {
    if (!current.value.has(alias)) return true;
  }
  return false;
});

async function save() {
  if (!changed.value || !fhmoSelectionValid.value) return;
  saving.value = true;
  error.value = '';
  const selectedList = [...selected.value];
  const currentList = [...current.value];
  const toAdd = selectedList.filter((alias) => !current.value.has(alias));
  const toRemove = currentList.filter((alias) => !selected.value.has(alias));
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
  <div class="card section-card tile fade-in shadow-sm mt-4">
    <div class="card-body p-2">
      <h2 class="card-title h5 mb-3">Роли</h2>
      <div v-if="groupedRoles.length">
        <div v-if="fhmoGroup" class="role-group role-group--fhmo">
          <h3 class="role-group__title">{{ fhmoGroup.name || 'Сотрудник ФХМ' }}</h3>
          <div class="fhmo-card">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <p class="mb-0 fw-semibold">Назначение сотрудника ФХМ</p>
              <div class="form-check form-switch mb-0">
                <input
                  id="fhmo-toggle"
                  class="form-check-input"
                  type="checkbox"
                  v-model="fhmoEnabled"
                />
                <label class="form-check-label" for="fhmo-toggle">
                  {{ fhmoEnabled ? 'Назначен' : 'Не назначен' }}
                </label>
              </div>
            </div>
            <p class="text-muted small mb-3">
              В рамках ФХМ пользователь может занимать только одну должность. Чтобы
              изменить позицию, выберите новое подразделение и должность.
            </p>
            <div v-if="fhmoEnabled" class="row g-3">
              <div class="col-12 col-lg-6">
                <label class="form-label" for="fhmo-department">Подразделение</label>
                <select
                  id="fhmo-department"
                  class="form-select"
                  v-model="fhmoDepartment"
                >
                  <option value="" disabled>Выберите подразделение</option>
                  <option
                    v-for="department in fhmoDepartments"
                    :key="department.key"
                    :value="department.key"
                  >
                    {{ department.name || 'Без подразделения' }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-lg-6">
                <label class="form-label">Должность</label>
                <div class="vstack gap-2" role="radiogroup" aria-label="Должность ФХМ">
                  <div
                    v-for="role in fhmoPositions"
                    :key="role.alias"
                    class="form-check"
                  >
                    <input
                      :id="`fhmo-role-${role.alias}`"
                      class="form-check-input"
                      type="radio"
                      name="fhmo-position"
                      :value="role.alias"
                      v-model="fhmoPosition"
                    />
                    <label class="form-check-label" :for="`fhmo-role-${role.alias}`">
                      {{ role.name }}
                    </label>
                  </div>
                  <p v-if="!fhmoPositions.length" class="text-muted small mb-0">
                    Нет доступных должностей для выбранного подразделения.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-for="group in displayGroups"
          :key="group.key"
          class="role-group"
        >
          <h3 v-if="group.name" class="role-group__title">
            {{ group.name }}
          </h3>
          <div
            v-for="department in group.departments"
            :key="department.key"
            class="role-department"
          >
            <h4 v-if="department.name" class="role-department__title">
              {{ department.name }}
            </h4>
            <div class="vstack gap-2">
              <div
                v-for="role in department.roles"
                :key="role.id"
                class="form-check"
              >
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
            </div>
          </div>
        </div>

        <button
          class="btn btn-brand mt-3"
          :disabled="saving || !changed || !fhmoSelectionValid"
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

<style scoped>
.role-group + .role-group {
  margin-top: 1.5rem;
}

.role-group__title {
  font-size: 0.9rem;
  text-transform: uppercase;
  color: var(--bs-secondary-color, #6c757d);
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}

.role-group--fhmo .role-group__title {
  margin-bottom: 0.75rem;
}

.role-department + .role-department {
  margin-top: 1rem;
}

.role-department__title {
  font-size: 0.85rem;
  color: var(--bs-secondary-color, #6c757d);
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.fhmo-card {
  border: 1px solid var(--border-subtle, #dfe5ec);
  border-radius: 0.75rem;
  padding: 1.25rem;
  background: var(--bs-body-bg);
}

.fhmo-card .form-check-label {
  font-weight: 500;
}
</style>
