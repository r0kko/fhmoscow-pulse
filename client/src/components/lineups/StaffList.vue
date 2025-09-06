<script setup>
const props = defineProps({
  groupedStaff: { type: Array, default: () => [] },
  filteredCount: { type: Number, default: 0 },
  staffSelected: { type: Object, default: () => new Set() },
  staffCategories: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  allStaffSelected: { type: Function, default: null },
  toggleAllStaff: { type: Function, default: null },
  toggleStaff: { type: Function, default: null },
  onStaffRoleChange: { type: Function, default: null },
});
</script>

<template>
  <div class="section-heading mt-2 mb-2">
    <span class="text-muted small fw-semibold">Представители команды</span>
  </div>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <div class="fw-semibold">
      Всего: {{ filteredCount }}
      <span class="text-muted">•</span>
      Выбрано:
      {{
        Array.from(staffSelected).filter((id) =>
          groupedStaff.some((g) => g.staff.some((r) => r.team_staff_id === id))
        ).length
      }}
    </div>
    <div class="d-flex gap-2 flex-wrap">
      <button
        class="btn btn-sm btn-outline-secondary"
        type="button"
        :disabled="filteredCount === 0"
        @click="() => toggleAllStaff && toggleAllStaff()"
      >
        {{
          allStaffSelected && allStaffSelected() ? 'Снять все' : 'Выбрать все'
        }}
      </button>
    </div>
  </div>
  <!-- Desktop/tablet view -->
  <div class="table-responsive d-none d-md-block">
    <table class="table align-middle">
      <thead>
        <tr class="text-muted small">
          <th style="width: 44px" class="text-center"></th>
          <th>ФИО</th>
          <th style="width: 220px">Должность на матч</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="grp in groupedStaff" :key="grp.group">
          <tr class="table-light">
            <td :colspan="3" class="fw-semibold">{{ grp.group }}</td>
          </tr>
          <tr v-for="r in grp.staff" :key="r.team_staff_id" class="fade-in">
            <td class="text-center">
              <input
                class="form-check-input"
                type="checkbox"
                :checked="staffSelected.has(r.team_staff_id)"
                @change="() => toggleStaff && toggleStaff(r)"
              />
            </td>
            <td>
              <div class="fw-semibold">{{ r.full_name }}</div>
            </td>
            <td>
              <select
                class="form-select form-select-sm"
                :disabled="!canEdit || !staffSelected.has(r.team_staff_id)"
                :value="r.match_role?.id ?? ''"
                aria-label="Должность представителя на матч"
                @change="(e) => onStaffRoleChange && onStaffRoleChange(r, e)"
              >
                <option v-for="c in staffCategories" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
            </td>
          </tr>
        </template>
        <tr v-if="filteredCount === 0">
          <td :colspan="3" class="text-muted py-3">
            Нет представителей по текущему фильтру
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <!-- Mobile view -->
  <div class="d-block d-md-none">
    <div v-if="filteredCount === 0" class="text-muted py-2 small">
      Нет представителей по текущему фильтру
    </div>
    <div v-for="grp in groupedStaff" :key="grp.group" class="mb-2">
      <div class="text-muted small fw-semibold mb-1">{{ grp.group }}</div>
      <div class="list-group">
        <div
          v-for="r in grp.staff"
          :key="r.team_staff_id"
          class="list-group-item py-2"
        >
          <div class="d-flex align-items-start gap-2">
            <input
              class="form-check-input mt-1"
              type="checkbox"
              :checked="staffSelected.has(r.team_staff_id)"
              aria-label="Выбрать представителя"
              @change="() => toggleStaff && toggleStaff(r)"
            />
            <div class="flex-grow-1">
              <div class="fw-semibold">{{ r.full_name }}</div>
              <div class="mt-1">
                <select
                  class="form-select form-select-sm"
                  :disabled="!canEdit || !staffSelected.has(r.team_staff_id)"
                  :value="r.match_role?.id ?? ''"
                  aria-label="Должность представителя на матч"
                  @change="(e) => onStaffRoleChange && onStaffRoleChange(r, e)"
                >
                  <option
                    v-for="c in staffCategories"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
