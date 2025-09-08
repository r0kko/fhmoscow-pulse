<script setup>
const props = defineProps({
  groupedRoster: { type: Array, default: () => [] },
  rosterLength: { type: Number, default: 0 },
  selected: { type: Object, default: () => new Set() },
  canEdit: { type: Boolean, default: false },
  isDouble: { type: Boolean, default: false },
  roles: { type: Array, default: () => [] },
  editedNumber: { type: Object, default: () => ({}) },
  editedRole: { type: Object, default: () => ({}) },
  editedSquad: { type: Object, default: () => ({}) },
  editedBoth: { type: Object, default: () => ({}) },
  isPlayerGk: { type: Function, default: () => false },
  gkCount: { type: Number, default: 0 },
  duplicateNumbersSet: { type: Object, default: () => new Set() },
  captainId: { type: [String, Number], default: '' },
  captain1Id: { type: [String, Number], default: '' },
  captain2Id: { type: [String, Number], default: '' },
  assistants: { type: Object, default: () => new Set() },
  assistants1: { type: Object, default: () => new Set() },
  assistants2: { type: Object, default: () => new Set() },
  onToggle: { type: Function, default: null },
  onNumberInput: { type: Function, default: null },
  onRoleChange: { type: Function, default: null },
  onSquadChange: { type: Function, default: null },
  onToggleCaptain: { type: Function, default: null },
  onToggleAssistant: { type: Function, default: null },
});
</script>

<template>
  <div>
    <div v-if="rosterLength === 0" class="text-muted py-2 small">
      Нет игроков по текущему фильтру
    </div>
    <div v-for="grp in groupedRoster" :key="grp.group" class="mb-2">
      <div class="text-muted small fw-semibold mb-1">{{ grp.group }}</div>
      <div class="list-group">
        <div
          v-for="p in grp.players"
          :key="p.team_player_id"
          class="list-group-item py-2"
        >
          <div class="d-flex align-items-start gap-2">
            <input
              class="form-check-input mt-1"
              type="checkbox"
              :checked="selected.has(p.team_player_id)"
              :disabled="!canEdit"
              aria-label="Выбрать игрока"
              @change="() => onToggle && onToggle(p)"
            />
            <div class="flex-grow-1">
              <div
                class="d-flex justify-content-between align-items-center gap-2"
              >
                <div class="fw-semibold">{{ p.full_name }}</div>
                <div
                  v-if="
                    canEdit && selected.has(p.team_player_id) && !isPlayerGk(p)
                  "
                  class="d-flex gap-1"
                >
                  <button
                    class="btn btn-xs btn-outline-secondary"
                    type="button"
                    :class="{
                      active:
                        (!isDouble && captainId === p.team_player_id) ||
                        (isDouble &&
                          ((editedSquad[p.team_player_id] ?? p.squad_no) === 1
                            ? captain1Id === p.team_player_id
                            : (editedSquad[p.team_player_id] ?? p.squad_no) ===
                                2
                              ? captain2Id === p.team_player_id
                              : false)),
                    }"
                    title="Капитан"
                    @click="() => onToggleCaptain && onToggleCaptain(p)"
                  >
                    К
                  </button>
                  <button
                    class="btn btn-xs btn-outline-secondary"
                    type="button"
                    :class="{
                      active:
                        (!isDouble && assistants.has(p.team_player_id)) ||
                        (isDouble &&
                          ((editedSquad[p.team_player_id] ?? p.squad_no) === 1
                            ? assistants1.has(p.team_player_id)
                            : (editedSquad[p.team_player_id] ?? p.squad_no) ===
                                2
                              ? assistants2.has(p.team_player_id)
                              : false)),
                    }"
                    title="Ассистент капитана"
                    @click="() => onToggleAssistant && onToggleAssistant(p)"
                  >
                    А
                  </button>
                </div>
              </div>
              <div v-if="p.date_of_birth" class="text-muted small mt-1">
                {{ new Date(p.date_of_birth).toLocaleDateString('ru-RU') }}
              </div>
              <div class="row gx-2 gy-2 mt-2">
                <div class="col-4">
                  <input
                    class="form-control form-control-sm"
                    type="number"
                    min="0"
                    max="99"
                    :disabled="!canEdit || !selected.has(p.team_player_id)"
                    :value="editedNumber[p.team_player_id] ?? ''"
                    aria-label="Игровой номер"
                    :class="{
                      'is-invalid':
                        selected.has(p.team_player_id) &&
                        (editedNumber[p.team_player_id] == null ||
                          isNaN(editedNumber[p.team_player_id])),
                    }"
                    @input="(e) => onNumberInput && onNumberInput(p, e)"
                  />
                </div>
                <div class="col-8">
                  <select
                    class="form-select form-select-sm"
                    :disabled="!canEdit || !selected.has(p.team_player_id)"
                    :value="editedRole[p.team_player_id] ?? ''"
                    aria-label="Амплуа в матче"
                    :class="{
                      'is-invalid':
                        selected.has(p.team_player_id) &&
                        !(editedRole[p.team_player_id] ?? null),
                    }"
                    @change="(e) => onRoleChange && onRoleChange(p, e)"
                  >
                    <option v-for="r in roles" :key="r.id" :value="r.id">
                      {{ r.name }}
                    </option>
                  </select>
                </div>
                <div v-if="isDouble" class="col-12">
                  <select
                    class="form-select form-select-sm"
                    :disabled="!canEdit || !selected.has(p.team_player_id)"
                    :value="
                      (function () {
                        if (isPlayerGk(p) && gkCount === 3) {
                          return (editedBoth[p.team_player_id] ??
                            p.squad_both ??
                            false)
                            ? 'both'
                            : String(
                                editedSquad[p.team_player_id] ??
                                  p.squad_no ??
                                  ''
                              );
                        }
                        return String(
                          editedSquad[p.team_player_id] ?? p.squad_no ?? ''
                        );
                      })()
                    "
                    aria-label="Состав (1/2/оба)"
                    :class="{
                      'is-invalid':
                        selected.has(p.team_player_id) &&
                        !(function () {
                          if (
                            isPlayerGk(p) &&
                            gkCount === 3 &&
                            (editedBoth[p.team_player_id] ??
                              p.squad_both ??
                              false)
                          )
                            return true;
                          const v =
                            editedSquad[p.team_player_id] ?? p.squad_no ?? null;
                          return v === 1 || v === 2;
                        })(),
                    }"
                    @change="(e) => onSquadChange && onSquadChange(p, e)"
                  >
                    <option value="" disabled>—</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option v-if="isPlayerGk(p) && gkCount === 3" value="both">
                      Оба состава
                    </option>
                  </select>
                  <div
                    v-if="
                      selected.has(p.team_player_id) &&
                      !(
                        isPlayerGk(p) &&
                        (editedBoth[p.team_player_id] ?? p.squad_both ?? false)
                      ) &&
                      !(
                        (editedSquad[p.team_player_id] ??
                          p.squad_no ??
                          null) === 1 ||
                        (editedSquad[p.team_player_id] ??
                          p.squad_no ??
                          null) === 2
                      )
                    "
                    class="invalid-feedback d-block"
                  >
                    Выберите состав (1 или 2)
                  </div>
                </div>
              </div>
              <div class="mt-1">
                <div
                  v-if="
                    selected.has(p.team_player_id) &&
                    (editedNumber[p.team_player_id] == null ||
                      isNaN(editedNumber[p.team_player_id]))
                  "
                  class="invalid-feedback d-block"
                >
                  Укажите номер
                </div>
                <div
                  v-else-if="
                    selected.has(p.team_player_id) &&
                    editedNumber[p.team_player_id] != null &&
                    duplicateNumbersSet.has(
                      String(editedNumber[p.team_player_id])
                    )
                  "
                  class="invalid-feedback d-block"
                >
                  Дублируется номер в составе
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn.btn-xs {
  --bs-btn-padding-y: 0.125rem;
  --bs-btn-padding-x: 0.375rem;
  --bs-btn-font-size: 0.75rem;
}
</style>
