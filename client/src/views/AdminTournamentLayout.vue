<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import TournamentHeaderCard from '../components/admin-tournament/TournamentHeaderCard.vue';
import TournamentModeTiles from '../components/admin-tournament/TournamentModeTiles.vue';
import { apiFetch } from '../api';
import { trackTournamentUiEvent } from '../utils/tournamentUiTelemetry';

const route = useRoute();

const tournament = ref<any>(null);
const loading = ref(false);
const error = ref('');

const competitionTypeOptions = ref<any[]>([]);
const scheduleManagementOptions = ref<any[]>([]);
const matchFormatOptions = ref<any[]>([]);
const refereePaymentOptions = ref<any[]>([]);
const groundOptions = ref<Array<{ id: string; name: string }>>([]);

const tournamentId = computed(() => String(route.params.tournamentId || ''));

const activeMode = computed<'structure' | 'schedule' | 'settings'>(() => {
  const name = String(route.name || '');
  if (name === 'adminTournamentSchedule') return 'schedule';
  if (name === 'adminTournamentSettings') return 'settings';
  return 'structure';
});

const breadcrumbs = computed(() => [
  { label: 'Администрирование', to: '/admin' },
  { label: 'Управление спортивной частью', disabled: true },
  { label: 'Турниры', to: '/admin/tournaments' },
  { label: tournament.value?.name || 'Турнир' },
]);

const summary = computed(() => ({
  stages: Number(tournament.value?.counts?.stages || 0),
  groups: Number(tournament.value?.counts?.groups || 0),
  teams: Number(tournament.value?.counts?.teams || 0),
  matches: Number(tournament.value?.counts?.matches || 0),
}));

const isImportedTournament = computed(
  () =>
    Boolean(tournament.value?.flags?.imported) ||
    tournament.value?.external_id != null
);

async function loadTournament(): Promise<void> {
  if (!tournamentId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await apiFetch(`/tournaments/${tournamentId.value}`);
    tournament.value = response.tournament || null;
    trackTournamentUiEvent({
      event: 'tournament_ui_opened',
      tournamentId: tournamentId.value,
      mode: activeMode.value,
    });
  } catch (err: any) {
    tournament.value = null;
    error.value = err?.message || 'Не удалось загрузить турнир';
  } finally {
    loading.value = false;
  }
}

async function loadSharedOptions(): Promise<void> {
  try {
    const [settingsRes, groundsRes] = await Promise.all([
      apiFetch('/tournaments/settings-options'),
      apiFetch('/grounds?limit=1000&order_by=name&order=ASC'),
    ]);
    competitionTypeOptions.value = settingsRes.competition_types || [];
    scheduleManagementOptions.value =
      settingsRes.schedule_management_types || [];
    matchFormatOptions.value = settingsRes.match_formats || [];
    refereePaymentOptions.value = settingsRes.referee_payment_types || [];
    groundOptions.value = (groundsRes.grounds || []).map((ground: any) => ({
      id: String(ground.id),
      name: ground.name || 'Без названия',
    }));
  } catch (_) {
    // no-op: отдельные формы обработают отсутствие справочников
  }
}

onMounted(async () => {
  await Promise.all([loadTournament(), loadSharedOptions()]);
});

watch(
  () => route.params.tournamentId,
  () => {
    void loadTournament();
  }
);
</script>

<template>
  <div class="py-4 admin-tournament-layout">
    <div class="container">
      <Breadcrumbs class="mb-2" :items="breadcrumbs" />

      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <BrandSpinner v-else-if="loading" label="Загрузка турнира" />

      <template v-else-if="tournament">
        <TournamentHeaderCard :tournament="tournament" :summary="summary" />
        <TournamentModeTiles
          :active-mode="activeMode"
          :tournament-id="tournamentId"
        />

        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :tournament="tournament"
            :tournament-id="tournamentId"
            :is-imported-tournament="isImportedTournament"
            :competition-type-options="competitionTypeOptions"
            :schedule-management-options="scheduleManagementOptions"
            :match-format-options="matchFormatOptions"
            :referee-payment-options="refereePaymentOptions"
            :ground-options="groundOptions"
            @refresh-tournament="loadTournament"
          />
        </RouterView>
      </template>
    </div>
  </div>
</template>

<style scoped></style>
