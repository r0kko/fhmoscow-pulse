<script setup>
import PlayerRow from './PlayerRow.vue';

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
  <div class="table-responsive">
    <table class="table align-middle">
      <thead>
        <tr class="text-muted small">
          <th style="width: 44px" class="text-center"></th>
          <th>Игрок</th>
          <th style="width: 120px">Д.р.</th>
          <th style="width: 120px">№ на матч</th>
          <th v-if="isDouble" style="width: 120px">Состав</th>
          <th style="width: 220px">Амплуа на матч</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="grp in groupedRoster" :key="grp.group">
          <tr class="table-light">
            <td :colspan="isDouble ? 6 : 5" class="fw-semibold">
              {{ grp.group }}
            </td>
          </tr>
          <PlayerRow
            v-for="p in grp.players"
            :key="p.team_player_id"
            :p="p"
            :can-edit="canEdit"
            :is-double="isDouble"
            :roles="roles"
            :selected="selected"
            :edited-number="editedNumber"
            :edited-role="editedRole"
            :edited-squad="editedSquad"
            :edited-both="editedBoth"
            :is-player-gk="isPlayerGk"
            :gk-count="gkCount"
            :duplicate-numbers-set="duplicateNumbersSet"
            :captain-id="captainId"
            :captain1-id="captain1Id"
            :captain2-id="captain2Id"
            :assistants="assistants"
            :assistants1="assistants1"
            :assistants2="assistants2"
            :on-toggle="onToggle"
            :on-number-input="onNumberInput"
            :on-role-change="onRoleChange"
            :on-squad-change="onSquadChange"
            :on-toggle-captain="onToggleCaptain"
            :on-toggle-assistant="onToggleAssistant"
          />
        </template>
        <tr v-if="rosterLength === 0">
          <td :colspan="isDouble ? 6 : 5" class="text-muted py-4">
            Нет игроков по текущему фильтру
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
