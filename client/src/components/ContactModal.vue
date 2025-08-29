<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const modalRef = ref(null);
let modal;
const contact = ref(null);

function ensureModal() {
  if (!modal && modalRef.value) modal = new Modal(modalRef.value);
}

function open(c) {
  contact.value = c || null;
  ensureModal();
  modal?.show();
}

function close() {
  modal?.hide();
}

function phoneHref(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  return digits ? `tel:+${digits}` : '#';
}

onMounted(() => {
  ensureModal();
});

onBeforeUnmount(() => {
  try {
    modal?.hide?.();
    modal?.dispose?.();
  } catch {}
});

defineExpose({ open, close });
</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1" aria-modal="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content rounded-4 overflow-hidden">
        <div class="modal-header">
          <h5 class="modal-title">{{ contact?.name || 'Контакты' }}</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Закрыть"
          ></button>
        </div>
        <div class="modal-body p-0">
          <div class="text-center p-3">
            <div
              class="mx-auto mb-2 rounded-circle bg-light d-flex align-items-center justify-content-center"
              style="width: 4rem; height: 4rem"
              aria-hidden="true"
            >
              <i class="bi bi-person-fill text-muted fs-2"></i>
            </div>
            <div>{{ contact?.name }}</div>
            <div v-if="contact?.title" class="text-muted small">
              {{ contact?.title }}
            </div>
          </div>
          <hr class="my-0" />
          <div class="list-group list-group-flush">
            <a
              v-if="contact?.phone"
              :href="phoneHref(contact.phone)"
              class="list-group-item list-group-item-action"
              aria-label="Позвонить"
            >
              <i class="bi bi-telephone me-2"></i>Позвонить
            </a>
            <a
              v-if="contact?.email"
              :href="`mailto:${contact.email}`"
              class="list-group-item list-group-item-action"
              aria-label="Написать на email"
            >
              <i class="bi bi-envelope me-2"></i>Написать на email
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rounded-4 {
  border-radius: 1rem !important;
}
</style>
