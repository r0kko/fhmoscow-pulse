<script setup>
const props = defineProps({
  p: { type: Object, required: true },
  canEdit: { type: Boolean, default: false },
  isDouble: { type: Boolean, default: false },
  roles: { type: Array, default: () => [] },
  selected: { type: Object, default: () => new Set() },
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

const isKeeperBothSelected = (player) =>
  props.isPlayerGk(player) &&
  props.gkCount === 3 &&
  (props.editedBoth[player.team_player_id] ?? player.squad_both ?? false);

const getSquadSelectValue = (player) => {
  if (isKeeperBothSelected(player)) {
    return 'both';
  }
  const base =
    props.editedSquad[player.team_player_id] ?? player.squad_no ?? '';
  return String(base);
};

const isSquadSelectionValid = (player) => {
  if (isKeeperBothSelected(player)) {
    return true;
  }
  const value =
    props.editedSquad[player.team_player_id] ?? player.squad_no ?? null;
  return value === 1 || value === 2;
};
</script>

<template>
  <tr class="fade-in">
    <td class="text-center">
      <input
        class="form-check-input"
        type="checkbox"
        :checked="selected.has(p.team_player_id)"
        :disabled="!canEdit"
        :aria-label="`Выбрать игрока ${p.full_name}`"
        @change="() => onToggle && onToggle(p)"
      />
    </td>
    <td>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="fw-semibold">{{ p.full_name }}</div>
        <div
          v-if="canEdit && selected.has(p.team_player_id) && !isPlayerGk(p)"
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
                    : (editedSquad[p.team_player_id] ?? p.squad_no) === 2
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
                    : (editedSquad[p.team_player_id] ?? p.squad_no) === 2
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
    </td>
    <td>
      <div>
        {{
          p.date_of_birth
            ? new Date(p.date_of_birth).toLocaleDateString('ru-RU')
            : ''
        }}
      </div>
    </td>
    <td>
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
          duplicateNumbersSet.has(String(editedNumber[p.team_player_id]))
        "
        class="invalid-feedback d-block"
      >
        Дублируется номер в составе
      </div>
    </td>
    <td v-if="isDouble">
      <select
        class="form-select form-select-sm"
        :disabled="!canEdit || !selected.has(p.team_player_id)"
        :value="getSquadSelectValue(p)"
        aria-label="Состав (1/2/оба)"
        :class="{
          'is-invalid':
            selected.has(p.team_player_id) && !isSquadSelectionValid(p),
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
        v-if="selected.has(p.team_player_id) && !isSquadSelectionValid(p)"
        class="invalid-feedback d-block"
      >
        Выберите состав (1 или 2)
      </div>
    </td>
    <td>
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
      <div
        v-if="
          selected.has(p.team_player_id) &&
          !(editedRole[p.team_player_id] ?? null)
        "
        class="invalid-feedback d-block"
      >
        Выберите амплуа
      </div>
    </td>
  </tr>
</template>
