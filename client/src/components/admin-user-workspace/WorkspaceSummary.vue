<script setup lang="ts">
import { computed } from 'vue';

import type { AdminUserProfileWorkspace } from '../../types/adminUserProfile';

const props = defineProps<{
  workspace: AdminUserProfileWorkspace;
}>();

const fullName = computed(() =>
  [
    props.workspace.user.last_name,
    props.workspace.user.first_name,
    props.workspace.user.patronymic,
  ]
    .filter(Boolean)
    .join(' ')
);
</script>

<template>
  <section class="card section-card shadow-sm border-0 mb-4 workspace-summary">
    <div class="card-body p-4">
      <div class="workspace-summary__layout">
        <div class="workspace-summary__identity">
          <h1 class="h2 workspace-summary__name mb-2">
            {{ fullName || workspace.user.email }}
          </h1>
          <div class="workspace-summary__pills">
            <span class="badge text-bg-light"
              >Статус: {{ workspace.user.status_name }}</span
            >
            <span
              class="badge"
              :class="
                workspace.user.email_confirmed
                  ? 'text-bg-success'
                  : 'text-bg-warning'
              "
            >
              {{
                workspace.user.email_confirmed
                  ? 'Email подтверждён'
                  : 'Email не подтверждён'
              }}
            </span>
            <span class="badge text-bg-light"
              >Ролей: {{ workspace.user.role_names.length }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workspace-summary {
  border-radius: 1.25rem;
}

.workspace-summary__layout {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.25rem;
}

.workspace-summary__identity {
  min-width: 0;
}

.workspace-summary__name {
  font-size: clamp(1.65rem, 2.8vw, 2.15rem);
  line-height: 1.1;
}

.workspace-summary__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 991.98px) {
  .workspace-summary__layout {
    flex-direction: column;
  }
}
</style>
