import { computed, ref, type Ref } from 'vue';

export type RefereeRoleOption = {
  value: string;
  label: string;
};

interface UseRefereeAvailabilityFiltersParams {
  roleOptions: RefereeRoleOption[];
  availableDates: Ref<string[]>;
  orderedDatesFromSet: (set: Set<string>) => string[];
  activeDateKeys: () => string[];
  shortDateLabel: (date: string) => string;
  formatHm: (time: string | null | undefined) => string;
}

export function useRefereeAvailabilityFilters({
  roleOptions,
  availableDates,
  orderedDatesFromSet,
  activeDateKeys,
  shortDateLabel,
  formatHm,
}: UseRefereeAvailabilityFiltersParams) {
  const selectedRoles = ref(new Set(roleOptions.map((r) => r.value)));
  const selectedDates = ref(new Set<string>());

  const filterFree = ref(false);
  const filterBusy = ref(false);
  const filterPartialEnabled = ref(false);
  const filterPartialMode = ref('');
  const filterPartialTime = ref('');

  const modalSelectedRoles = ref(new Set<string>());
  const modalSelectedDates = ref(new Set<string>());
  const modalFilterFree = ref(false);
  const modalFilterBusy = ref(false);
  const modalFilterPartialEnabled = ref(false);
  const modalFilterPartialMode = ref('');
  const modalFilterPartialTime = ref('');

  const roleFilterActive = computed(
    () => selectedRoles.value.size !== roleOptions.length
  );
  const dateFilterActive = computed(() => {
    if (!availableDates.value.length) return false;
    return (
      selectedDates.value.size > 0 &&
      selectedDates.value.size < availableDates.value.length
    );
  });
  const statusFilterActive = computed(
    () => filterFree.value || filterBusy.value || filterPartialEnabled.value
  );
  const activeFiltersCount = computed(() => {
    let count = 0;
    if (roleFilterActive.value) count += 1;
    if (dateFilterActive.value) count += 1;
    if (statusFilterActive.value) count += 1;
    return count;
  });

  const modalSelectedDatesSize = computed(() => modalSelectedDates.value.size);
  const modalStatusDisabled = computed(
    () => availableDates.value.length > 0 && modalSelectedDates.value.size === 0
  );
  const modalRoleSelectionValid = computed(
    () => modalSelectedRoles.value.size > 0
  );

  function prepareFilters() {
    modalSelectedRoles.value = new Set(selectedRoles.value);
    const baseDates =
      selectedDates.value.size > 0
        ? orderedDatesFromSet(selectedDates.value)
        : activeDateKeys();
    modalSelectedDates.value = new Set(baseDates);
    modalFilterFree.value = filterFree.value;
    modalFilterBusy.value = filterBusy.value;
    modalFilterPartialEnabled.value = filterPartialEnabled.value;
    modalFilterPartialMode.value = filterPartialMode.value;
    modalFilterPartialTime.value = filterPartialTime.value;
  }

  function toggleModalRole(val: string) {
    const next = new Set(modalSelectedRoles.value);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    modalSelectedRoles.value = next;
  }

  function toggleModalDate(date: string) {
    const next = new Set(modalSelectedDates.value);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    modalSelectedDates.value = next;
  }

  function selectAllModalDates() {
    modalSelectedDates.value = new Set(availableDates.value);
  }

  function clearModalDates() {
    modalSelectedDates.value = new Set();
    modalFilterFree.value = false;
    modalFilterBusy.value = false;
    modalFilterPartialEnabled.value = false;
    modalFilterPartialMode.value = '';
    modalFilterPartialTime.value = '';
  }

  function handleModalPartialToggle() {
    if (!modalFilterPartialEnabled.value) {
      modalFilterPartialMode.value = '';
      modalFilterPartialTime.value = '';
    }
  }

  function resetModalFilters() {
    modalSelectedRoles.value = new Set(roleOptions.map((r) => r.value));
    modalSelectedDates.value = new Set(availableDates.value);
    modalFilterFree.value = false;
    modalFilterBusy.value = false;
    modalFilterPartialEnabled.value = false;
    modalFilterPartialMode.value = '';
    modalFilterPartialTime.value = '';
  }

  function applyModalFilters() {
    if (!modalRoleSelectionValid.value) {
      return false;
    }

    selectedRoles.value = new Set(modalSelectedRoles.value);

    const ordered = orderedDatesFromSet(modalSelectedDates.value);
    selectedDates.value = new Set(
      ordered.length ? ordered : availableDates.value
    );

    filterFree.value = modalFilterFree.value;
    filterBusy.value = modalFilterBusy.value;
    filterPartialEnabled.value = modalFilterPartialEnabled.value;
    if (modalFilterPartialEnabled.value) {
      filterPartialMode.value = modalFilterPartialMode.value;
      filterPartialTime.value = modalFilterPartialTime.value;
    } else {
      filterPartialMode.value = '';
      filterPartialTime.value = '';
    }
    return true;
  }

  const filtersSummary = computed(() => {
    const items: { key: string; text: string }[] = [];
    if (roleFilterActive.value) {
      const labels = roleOptions
        .filter((opt) => selectedRoles.value.has(opt.value))
        .map((opt) => opt.label);
      if (labels.length) {
        items.push({ key: 'roles', text: `Роли: ${labels.join(', ')}` });
      }
    }
    if (dateFilterActive.value) {
      const ordered = orderedDatesFromSet(selectedDates.value);
      if (ordered.length) {
        const labels = ordered.slice(0, 3).map((d) => shortDateLabel(d) || d);
        if (ordered.length > 3) {
          labels.push(`+${ordered.length - 3}`);
        }
        items.push({ key: 'dates', text: `Даты: ${labels.join(', ')}` });
      }
    }
    if (statusFilterActive.value) {
      const parts: string[] = [];
      if (filterFree.value) parts.push('Свободен');
      if (filterBusy.value) parts.push('Занят');
      if (filterPartialEnabled.value) {
        if (filterPartialMode.value === 'BEFORE') {
          const time = filterPartialTime.value
            ? formatHm(filterPartialTime.value)
            : '';
          parts.push(`Частично (до${time ? ` ${time}` : ''})`);
        } else if (filterPartialMode.value === 'AFTER') {
          const time = filterPartialTime.value
            ? formatHm(filterPartialTime.value)
            : '';
          parts.push(`Частично (после${time ? ` ${time}` : ''})`);
        } else if (filterPartialMode.value === 'WINDOW') {
          const time = filterPartialTime.value
            ? formatHm(filterPartialTime.value)
            : '';
          parts.push(`Частично (с/по${time ? ` ${time}` : ''})`);
        } else if (filterPartialMode.value === 'SPLIT') {
          const time = filterPartialTime.value
            ? formatHm(filterPartialTime.value)
            : '';
          parts.push(`Частично (до/после${time ? ` ${time}` : ''})`);
        } else {
          parts.push('Частично');
        }
      }
      if (parts.length) {
        items.push({ key: 'status', text: `Статусы: ${parts.join(', ')}` });
      }
    }
    return items;
  });

  return {
    selectedRoles,
    selectedDates,
    filterFree,
    filterBusy,
    filterPartialEnabled,
    filterPartialMode,
    filterPartialTime,
    modalSelectedRoles,
    modalSelectedDates,
    modalFilterFree,
    modalFilterBusy,
    modalFilterPartialEnabled,
    modalFilterPartialMode,
    modalFilterPartialTime,
    roleFilterActive,
    dateFilterActive,
    statusFilterActive,
    activeFiltersCount,
    modalSelectedDatesSize,
    modalStatusDisabled,
    modalRoleSelectionValid,
    prepareFilters,
    toggleModalRole,
    toggleModalDate,
    selectAllModalDates,
    clearModalDates,
    handleModalPartialToggle,
    resetModalFilters,
    applyModalFilters,
    filtersSummary,
  };
}

export default useRefereeAvailabilityFilters;
