<script setup lang="ts">
type SuggestionUser = {
  id: string;
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  email?: string;
  phone?: string;
};

type EditorDay = {
  date: string;
  preset?: boolean;
  status?: string | null;
  currentStatus?: string | null;
  partialMode?: string | null;
  from_time?: string | null;
  to_time?: string | null;
};

const props = defineProps<{
  modalId?: string;
  editorError: string;
  editorLookupLoading: boolean;
  editorSuggestions: SuggestionUser[];
  editorSelectedUser: SuggestionUser | null;
  editorLoading: boolean;
  editorSaving: boolean;
  editorSuccessTs: number;
  editorDays: EditorDay[];
  editorDateList: string[];
  editorInvalidCount: number;
  editorHasSelection: boolean;
  editorChanges: Array<Record<string, unknown>>;
  editorCanSave: boolean;
  editorUserQuery: string;
  statusLabels: Record<string, string>;
  nameOf: (u: SuggestionUser) => string;
  shortDateLabel: (date: string) => string;
  longDateLabel: (date: string) => string;
  formatHm: (value: string | null | undefined) => string;
  editorEffectiveStatus: (day: EditorDay) => string | null;
  editorIsPartial: (day: EditorDay) => boolean;
  editorIsValidPartial: (day: EditorDay) => boolean;
}>();

const emit = defineEmits<{
  'update:editorUserQuery': [value: string];
  pickUser: [user: SuggestionUser];
  setStatus: [day: EditorDay, status: string];
  setPartialMode: [day: EditorDay, mode: string];
  clearDay: [day: EditorDay];
  close: [];
  save: [];
}>();

const modalId = props.modalId || 'editorModal';

function onEditorUserInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit('update:editorUserQuery', (target?.value || '').trim());
}

function editorRangeStartLabel() {
  const date = props.editorDateList[0];
  return date ? props.longDateLabel(date) : '';
}

function editorRangeEndLabel() {
  const lastIndex = props.editorDateList.length - 1;
  const date = lastIndex >= 0 ? props.editorDateList[lastIndex] : '';
  return date ? props.longDateLabel(date) : '';
}
</script>

<template>
  <div :id="modalId" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Корректировка занятости</h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="emit('close')"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="editorError" class="alert alert-danger" role="alert">
            {{ editorError }}
          </div>
          <div class="row g-3">
            <div class="col-12 col-lg-4">
              <div class="editor-card h-100 border rounded-3 p-3">
                <label class="form-label fw-semibold" for="editorUser"
                  >Пользователь</label
                >
                <div class="input-group input-group-sm">
                  <span class="input-group-text"
                    ><i class="bi bi-search" aria-hidden="true"></i
                  ></span>
                  <input
                    id="editorUser"
                    :value="editorUserQuery"
                    type="search"
                    class="form-control"
                    placeholder="Фамилия, email или телефон"
                    autocomplete="off"
                    @input="onEditorUserInput"
                  />
                  <span
                    v-if="editorLookupLoading"
                    class="input-group-text"
                    aria-label="Поиск"
                  >
                    <span
                      class="spinner-border spinner-border-sm text-brand"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </span>
                </div>
                <div
                  v-if="editorSuggestions.length"
                  class="list-group suggestion-list mt-2"
                >
                  <button
                    v-for="u in editorSuggestions"
                    :key="u.id"
                    type="button"
                    class="list-group-item list-group-item-action"
                    @click="emit('pickUser', u)"
                  >
                    <div class="fw-semibold">{{ nameOf(u) }}</div>
                    <div class="small text-muted">
                      {{ u.email || u.phone || 'Аккаунт без контактов' }}
                    </div>
                  </button>
                </div>
                <p class="small text-muted mb-0 mt-2">
                  Доступны только активные судьи с правом входа в раздел «Моя
                  занятость».
                </p>
                <div
                  v-if="editorSelectedUser"
                  class="selected-user mt-3 p-2 bg-light rounded"
                >
                  <div class="fw-semibold">
                    {{ nameOf(editorSelectedUser) }}
                  </div>
                  <div class="small text-muted">
                    {{
                      editorSelectedUser.email ||
                      editorSelectedUser.phone ||
                      'Контакты не указаны'
                    }}
                  </div>
                  <span class="badge bg-secondary-subtle text-secondary mt-1"
                    >Активен</span
                  >
                </div>
              </div>
            </div>
            <div class="col-12 col-lg-8">
              <div class="editor-card h-100 border rounded-3 p-3">
                <div
                  class="d-flex align-items-center justify-content-between gap-3 mb-2 flex-wrap"
                >
                  <div>
                    <div class="fw-semibold">Ближайшие дни</div>
                    <div class="text-muted small">
                      <template v-if="editorDateList.length">
                        {{ editorRangeStartLabel() }} —
                        {{ editorRangeEndLabel() }}
                      </template>
                      <template v-else>Нет доступных дат</template>
                    </div>
                  </div>
                  <span
                    v-if="editorSuccessTs && !editorSaving"
                    class="badge bg-success-subtle text-success"
                  >
                    Сохранено
                  </span>
                </div>

                <div
                  v-if="!editorHasSelection"
                  class="text-muted placeholder-panel"
                >
                  Выберите судью слева, чтобы открыть его расписание.
                </div>
                <div v-else-if="editorLoading" class="text-center py-4">
                  <div
                    class="spinner-border spinner-brand"
                    role="status"
                    aria-label="Загрузка"
                  ></div>
                </div>
                <div v-else>
                  <div
                    v-if="editorInvalidCount"
                    class="alert alert-warning py-2"
                  >
                    Для частичных дней укажите время — осталось
                    {{ editorInvalidCount }}.
                  </div>
                  <div v-if="!editorDays.length" class="text-muted">
                    Нет дат для редактирования.
                  </div>
                  <div v-else class="editor-days-list">
                    <div
                      v-for="day in editorDays"
                      :key="day.date"
                      class="editor-day d-flex flex-column flex-sm-row gap-3"
                    >
                      <div class="editor-day-date text-nowrap">
                        <div class="fw-semibold">
                          {{ shortDateLabel(day.date) }}
                        </div>
                        <div class="text-muted small">
                          {{ longDateLabel(day.date) }}
                        </div>
                        <div class="small mt-1">
                          <span
                            v-if="day.preset"
                            class="badge bg-secondary-subtle text-secondary"
                          >
                            Указано пользователем
                          </span>
                          <span v-else class="text-muted">Не задано</span>
                        </div>
                      </div>
                      <div class="editor-day-controls flex-grow-1">
                        <div
                          class="btn-group btn-group-sm flex-wrap"
                          role="group"
                          aria-label="Статус на дату"
                        >
                          <button
                            type="button"
                            class="btn btn-outline-success"
                            :class="{
                              active: editorEffectiveStatus(day) === 'FREE',
                            }"
                            @click="emit('setStatus', day, 'FREE')"
                          >
                            Свободен
                          </button>
                          <button
                            type="button"
                            class="btn btn-outline-warning"
                            :class="{
                              active: editorEffectiveStatus(day) === 'PARTIAL',
                            }"
                            @click="emit('setStatus', day, 'PARTIAL')"
                          >
                            Частично
                          </button>
                          <button
                            type="button"
                            class="btn btn-outline-secondary"
                            :class="{
                              active: editorEffectiveStatus(day) === 'BUSY',
                            }"
                            @click="emit('setStatus', day, 'BUSY')"
                          >
                            Занят
                          </button>
                        </div>
                        <div
                          v-if="editorIsPartial(day)"
                          class="partial-controls d-flex flex-wrap align-items-center gap-2 mt-2"
                        >
                          <div class="btn-group btn-group-sm" role="group">
                            <input
                              :id="'partial-before-' + day.date"
                              type="radio"
                              class="btn-check"
                              :checked="day.partialMode === 'BEFORE'"
                              @change="emit('setPartialMode', day, 'BEFORE')"
                            />
                            <label
                              class="btn btn-outline-secondary"
                              :for="'partial-before-' + day.date"
                              >До</label
                            >
                            <input
                              :id="'partial-after-' + day.date"
                              type="radio"
                              class="btn-check"
                              :checked="day.partialMode === 'AFTER'"
                              @change="emit('setPartialMode', day, 'AFTER')"
                            />
                            <label
                              class="btn btn-outline-secondary"
                              :for="'partial-after-' + day.date"
                              >После</label
                            >
                            <input
                              :id="'partial-window-' + day.date"
                              type="radio"
                              class="btn-check"
                              :checked="day.partialMode === 'WINDOW'"
                              @change="emit('setPartialMode', day, 'WINDOW')"
                            />
                            <label
                              class="btn btn-outline-secondary"
                              :for="'partial-window-' + day.date"
                              >С—по</label
                            >
                            <input
                              :id="'partial-split-' + day.date"
                              type="radio"
                              class="btn-check"
                              :checked="day.partialMode === 'SPLIT'"
                              @change="emit('setPartialMode', day, 'SPLIT')"
                            />
                            <label
                              class="btn btn-outline-secondary"
                              :for="'partial-split-' + day.date"
                              >До и после</label
                            >
                          </div>
                          <div
                            v-if="day.partialMode === 'AFTER'"
                            class="input-group input-group-sm time-input"
                          >
                            <span class="input-group-text"
                              ><i class="bi bi-clock" aria-hidden="true"></i
                            ></span>
                            <input
                              v-model="day.from_time"
                              type="time"
                              class="form-control"
                              step="300"
                              :class="{
                                'is-invalid': !editorIsValidPartial(day),
                              }"
                              :aria-label="'Доступен после указанного времени'"
                              :title="'Доступен после указанного времени'"
                            />
                          </div>
                          <div
                            v-else-if="day.partialMode === 'BEFORE'"
                            class="input-group input-group-sm time-input"
                          >
                            <span class="input-group-text"
                              ><i class="bi bi-clock" aria-hidden="true"></i
                            ></span>
                            <input
                              v-model="day.to_time"
                              type="time"
                              class="form-control"
                              step="300"
                              :class="{
                                'is-invalid': !editorIsValidPartial(day),
                              }"
                              :aria-label="'Доступен до указанного времени'"
                              :title="'Доступен до указанного времени'"
                            />
                          </div>
                          <div
                            v-else-if="day.partialMode === 'WINDOW'"
                            class="d-flex flex-wrap gap-2"
                          >
                            <div class="input-group input-group-sm time-input">
                              <span class="input-group-text"
                                ><i class="bi bi-clock" aria-hidden="true"></i
                              ></span>
                              <input
                                v-model="day.from_time"
                                type="time"
                                class="form-control"
                                step="300"
                                :class="{
                                  'is-invalid': !editorIsValidPartial(day),
                                }"
                                :aria-label="'Доступен с указанного времени'"
                                :title="'Доступен с указанного времени'"
                              />
                            </div>
                            <div class="input-group input-group-sm time-input">
                              <span class="input-group-text"
                                ><i class="bi bi-clock" aria-hidden="true"></i
                              ></span>
                              <input
                                v-model="day.to_time"
                                type="time"
                                class="form-control"
                                step="300"
                                :class="{
                                  'is-invalid': !editorIsValidPartial(day),
                                }"
                                :aria-label="'Доступен до указанного времени'"
                                :title="'Доступен до указанного времени'"
                              />
                            </div>
                          </div>
                          <div v-else class="d-flex flex-wrap gap-2">
                            <div class="input-group input-group-sm time-input">
                              <span class="input-group-text"
                                ><i class="bi bi-clock" aria-hidden="true"></i
                              ></span>
                              <input
                                v-model="day.to_time"
                                type="time"
                                class="form-control"
                                step="300"
                                :class="{
                                  'is-invalid': !editorIsValidPartial(day),
                                }"
                                :aria-label="'Доступен до указанного времени'"
                                :title="'Доступен до указанного времени'"
                              />
                            </div>
                            <div class="input-group input-group-sm time-input">
                              <span class="input-group-text"
                                ><i class="bi bi-clock" aria-hidden="true"></i
                              ></span>
                              <input
                                v-model="day.from_time"
                                type="time"
                                class="form-control"
                                step="300"
                                :class="{
                                  'is-invalid': !editorIsValidPartial(day),
                                }"
                                :aria-label="'Доступен после указанного времени'"
                                :title="'Доступен после указанного времени'"
                              />
                            </div>
                          </div>
                        </div>
                        <div class="d-flex align-items-center gap-2 mt-2">
                          <span class="small text-muted">
                            {{
                              statusLabels[editorEffectiveStatus(day) || ''] ||
                              'Не задано'
                            }}
                            <template v-if="editorIsPartial(day)">
                              •
                              <template v-if="day.partialMode === 'BEFORE'">
                                до {{ formatHm(day.to_time) || '—' }}
                              </template>
                              <template v-else-if="day.partialMode === 'AFTER'">
                                после {{ formatHm(day.from_time) || '—' }}
                              </template>
                              <template
                                v-else-if="day.partialMode === 'WINDOW'"
                              >
                                с {{ formatHm(day.from_time) || '—' }} до
                                {{ formatHm(day.to_time) || '—' }}
                              </template>
                              <template v-else>
                                до {{ formatHm(day.to_time) || '—' }} и после
                                {{ formatHm(day.from_time) || '—' }}
                              </template>
                            </template>
                          </span>
                          <button
                            type="button"
                            class="btn btn-link btn-sm p-0"
                            :disabled="
                              !(
                                day.preset ||
                                day.currentStatus ||
                                day.from_time ||
                                day.to_time
                              )
                            "
                            @click="emit('clearDay', day)"
                          >
                            Очистить
                          </button>
                        </div>
                        <div
                          v-if="
                            editorIsPartial(day) && !editorIsValidPartial(day)
                          "
                          class="invalid-feedback d-block"
                        >
                          Укажите время для частичной занятости
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="text-muted small me-auto">
            <template v-if="editorChanges.length"
              >Изменений: {{ editorChanges.length }}</template
            >
            <template v-else>Нет изменений</template>
          </div>
          <button
            type="button"
            class="btn btn-outline-secondary"
            @click="emit('close')"
          >
            Закрыть
          </button>
          <button
            type="button"
            class="btn btn-brand"
            :disabled="!editorCanSave || editorSaving"
            @click="emit('save')"
          >
            <span
              v-if="editorSaving"
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-card {
  background: var(--surface-elevated, #fff);
  box-shadow: 0 0.75rem 1.5rem rgba(15, 23, 42, 0.06);
}
.suggestion-list {
  max-height: 14rem;
  overflow-y: auto;
  border-radius: 0.75rem;
}
.placeholder-panel {
  min-height: 8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px dashed var(--border-subtle, #e9ecef);
  border-radius: 0.75rem;
  padding: 1rem;
}
.editor-days-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.editor-day {
  padding: 0.75rem 0.75rem;
  border: 1px solid var(--border-subtle, #e9ecef);
  border-radius: 0.75rem;
  background: #fff;
}
.editor-day-date .fw-semibold {
  letter-spacing: 0.01em;
}
.editor-day-controls .btn-group .btn {
  min-width: 6rem;
}
.partial-controls .time-input {
  max-width: 11rem;
}
.selected-user {
  border: 1px solid var(--border-subtle, #e9ecef);
}
</style>
