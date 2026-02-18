<script setup lang="ts">
// @ts-nocheck
import TabSelector from '../TabSelector.vue';
import BrandSpinner from '../BrandSpinner.vue';

const props = defineProps<{
  section: string;
  sectionTabs: Array<{ key: string; label: string }>;
  stageFilter: string;
  stageOptions: Array<{ id: string; name: string }>;
  loading: boolean;
  error: string;
  mainSettings: any;
  competitionTypeOptions: any[];
  scheduleManagementOptions: any[];
  matchFormatOptions: any[];
  refereePaymentOptions: any[];
  settingsGroupsByStage: any[];
  settingsEdits: Record<string, any>;
  refereeRoleGroups: any[];
  refereeEdits: Record<string, any>;
}>();

const emit = defineEmits<{
  updateSection: [string];
  updateStage: [string];
  updateMainField: [string, string];
  saveMain: [];
  markMainDirty: [];
  updateDuration: [string, 'hours' | 'minutes', string];
  saveGroupSettings: [any];
  setRefereeCount: [string, string, string];
  saveGroupReferees: [any];
}>();
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <TabSelector
      :model-value="props.section"
      :tabs="props.sectionTabs"
      :aria-label="'Раздел настроек турнира'"
      @update:model-value="
        (value: string | number) => emit('updateSection', String(value))
      "
    />

    <div class="row g-2 align-items-end">
      <div class="col-12 col-md-5">
        <label class="form-label">Этап</label>
        <select
          :value="props.stageFilter"
          class="form-select"
          @change="
            emit(
              'updateStage',
              String(($event.target as HTMLSelectElement).value || '')
            )
          "
        >
          <option
            v-for="stage in props.stageOptions"
            :key="stage.id || 'all'"
            :value="stage.id"
          >
            {{ stage.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="props.error" class="alert alert-danger mb-0">
      {{ props.error }}
    </div>

    <BrandSpinner v-if="props.loading" label="Загрузка настроек" />
    <template v-else>
      <div
        v-if="props.section === 'main'"
        class="card section-card tile shadow-sm"
      >
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-lg-4">
              <label class="form-label">Тип соревнований</label>
              <select
                :value="props.mainSettings.competition_type_id"
                class="form-select"
                @change="
                  emit(
                    'updateMainField',
                    'competition_type_id',
                    String(($event.target as HTMLSelectElement).value || '')
                  );
                  emit('markMainDirty');
                "
              >
                <option value="">Не задан</option>
                <option
                  v-for="item in props.competitionTypeOptions"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.name }}
                </option>
              </select>
            </div>
            <div class="col-12 col-lg-4">
              <label class="form-label">Управление расписанием</label>
              <select
                :value="props.mainSettings.schedule_management_type_id"
                class="form-select"
                @change="
                  emit(
                    'updateMainField',
                    'schedule_management_type_id',
                    String(($event.target as HTMLSelectElement).value || '')
                  );
                  emit('markMainDirty');
                "
              >
                <option value="">Выберите вариант</option>
                <option
                  v-for="item in props.scheduleManagementOptions"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.name }}
                </option>
              </select>
            </div>
            <div class="col-12 col-lg-4">
              <label class="form-label">Формат проведения</label>
              <select
                :value="props.mainSettings.match_format"
                class="form-select"
                @change="
                  emit(
                    'updateMainField',
                    'match_format',
                    String(($event.target as HTMLSelectElement).value || '')
                  );
                  emit('markMainDirty');
                "
              >
                <option value="">Не задан</option>
                <option
                  v-for="format in props.matchFormatOptions"
                  :key="format.value"
                  :value="format.value"
                >
                  {{ format.label }}
                </option>
              </select>
            </div>
            <div class="col-12 col-lg-4">
              <label class="form-label">Расчеты с судьями</label>
              <select
                :value="props.mainSettings.referee_payment_type"
                class="form-select"
                @change="
                  emit(
                    'updateMainField',
                    'referee_payment_type',
                    String(($event.target as HTMLSelectElement).value || '')
                  );
                  emit('markMainDirty');
                "
              >
                <option value="">Не задано</option>
                <option
                  v-for="item in props.refereePaymentOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </select>
            </div>
            <div class="col-12 col-lg-3">
              <button
                type="button"
                class="btn btn-brand btn-sm w-100 icon-action"
                :disabled="
                  props.mainSettings.saving || !props.mainSettings.dirty
                "
                title="Сохранить основные настройки"
                aria-label="Сохранить основные настройки"
                @click="emit('saveMain')"
              >
                <span
                  v-if="props.mainSettings.saving"
                  class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-check2" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div v-if="props.mainSettings.error" class="text-danger small mt-2">
            {{ props.mainSettings.error }}
          </div>
        </div>
      </div>

      <div v-if="props.section !== 'main'" class="accordion">
        <div
          v-for="bucket in props.settingsGroupsByStage"
          :key="bucket.stage.id"
          class="accordion-item"
        >
          <h2 :id="`settings-${bucket.stage.id}`" class="accordion-header">
            <button
              class="accordion-button"
              type="button"
              :class="{ collapsed: false }"
              data-bs-toggle="collapse"
              :data-bs-target="`#settings-body-${bucket.stage.id}`"
              aria-expanded="true"
              :aria-controls="`settings-body-${bucket.stage.id}`"
            >
              {{ bucket.stage.name || 'Этап' }}
            </button>
          </h2>
          <div
            :id="`settings-body-${bucket.stage.id}`"
            class="accordion-collapse collapse show"
            :aria-labelledby="`settings-${bucket.stage.id}`"
          >
            <div class="accordion-body">
              <div v-if="bucket.groups.length" class="d-flex flex-column gap-2">
                <div
                  v-for="group in bucket.groups"
                  :key="group.id"
                  class="border rounded-3 p-3"
                >
                  <div class="fw-semibold">{{ group.name || 'Группа' }}</div>

                  <div
                    v-if="props.section !== 'referees'"
                    class="row g-2 align-items-end mt-1"
                  >
                    <div class="col-6 col-md-2">
                      <label class="form-label">Часы</label>
                      <input
                        :value="props.settingsEdits[group.id]?.hours"
                        type="number"
                        class="form-control"
                        min="0"
                        max="24"
                        @input="
                          emit(
                            'updateDuration',
                            group.id,
                            'hours',
                            String(
                              ($event.target as HTMLInputElement).value || ''
                            )
                          )
                        "
                      />
                    </div>
                    <div class="col-6 col-md-2">
                      <label class="form-label">Минуты</label>
                      <input
                        :value="props.settingsEdits[group.id]?.minutes"
                        type="number"
                        class="form-control"
                        min="0"
                        max="59"
                        @input="
                          emit(
                            'updateDuration',
                            group.id,
                            'minutes',
                            String(
                              ($event.target as HTMLInputElement).value || ''
                            )
                          )
                        "
                      />
                    </div>
                    <div class="col-12 col-md-3">
                      <button
                        type="button"
                        class="btn btn-brand btn-sm w-100 icon-action"
                        :disabled="
                          props.settingsEdits[group.id]?.saving ||
                          !props.settingsEdits[group.id]?.dirty
                        "
                        title="Сохранить параметры группы"
                        aria-label="Сохранить параметры группы"
                        @click="emit('saveGroupSettings', group)"
                      >
                        <i class="bi bi-check2" aria-hidden="true"></i>
                      </button>
                    </div>
                    <div
                      v-if="props.settingsEdits[group.id]?.error"
                      class="col-12"
                    >
                      <div class="text-danger small">
                        {{ props.settingsEdits[group.id].error }}
                      </div>
                    </div>
                  </div>

                  <div v-if="props.section !== 'groups'" class="mt-3">
                    <div class="fw-semibold">Судейский состав</div>
                    <div v-if="props.refereeRoleGroups.length">
                      <div
                        v-for="roleGroup in props.refereeRoleGroups"
                        :key="roleGroup.id"
                        class="mt-2"
                      >
                        <div class="small text-muted mb-1">
                          {{ roleGroup.name }}
                        </div>
                        <div class="row g-2">
                          <div
                            v-for="role in roleGroup.roles"
                            :key="role.id"
                            class="col-6 col-lg-4"
                          >
                            <label class="form-label small">{{
                              role.name
                            }}</label>
                            <select
                              :value="
                                props.refereeEdits[group.id]?.counts?.[
                                  role.id
                                ] ?? 0
                              "
                              class="form-select form-select-sm"
                              @change="
                                emit(
                                  'setRefereeCount',
                                  group.id,
                                  role.id,
                                  String(
                                    ($event.target as HTMLSelectElement)
                                      .value || '0'
                                  )
                                )
                              "
                            >
                              <option :value="0">0</option>
                              <option :value="1">1</option>
                              <option :value="2">2</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div
                        v-if="props.refereeEdits[group.id]?.error"
                        class="text-danger small mt-2"
                      >
                        {{ props.refereeEdits[group.id].error }}
                      </div>
                      <button
                        type="button"
                        class="btn btn-brand btn-sm mt-2 icon-action"
                        :disabled="
                          !props.refereeEdits[group.id]?.dirty ||
                          props.refereeEdits[group.id]?.saving
                        "
                        title="Сохранить судейский состав"
                        aria-label="Сохранить судейский состав"
                        @click="emit('saveGroupReferees', group)"
                      >
                        <i class="bi bi-check2" aria-hidden="true"></i>
                      </button>
                    </div>
                    <div v-else class="small text-muted">
                      Должности судей не настроены.
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="small text-muted">
                Группы этапа отсутствуют.
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.icon-action {
  min-width: 2rem;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
