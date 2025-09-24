<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

interface BreadcrumbItem {
  label: string;
  to?: RouteLocationRaw;
  disabled?: boolean;
}

interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  ariaLabel?: string;
}

const props = withDefaults(defineProps<BreadcrumbsProps>(), {
  ariaLabel: 'breadcrumb',
});

const lastIndex = computed(() => props.items.length - 1);

function isLast(idx: number): boolean {
  return idx === lastIndex.value;
}

const linkMicrodata = Object.freeze({ itemprop: 'item' });
</script>

<template>
  <nav :aria-label="ariaLabel">
    <ol
      class="breadcrumb mb-0"
      itemscope
      itemtype="https://schema.org/BreadcrumbList"
    >
      <li
        v-for="(item, idx) in items"
        :key="idx"
        class="breadcrumb-item"
        :class="{
          active: isLast(idx),
          disabled: !isLast(idx) && item?.disabled,
        }"
        :aria-current="isLast(idx) ? 'page' : undefined"
        :aria-disabled="!isLast(idx) && item?.disabled ? 'true' : undefined"
        itemprop="itemListElement"
        itemscope
        itemtype="https://schema.org/ListItem"
      >
        <template v-if="!isLast(idx) && item.to && !item.disabled">
          <RouterLink :to="item.to" v-bind="linkMicrodata">
            <span itemprop="name">{{ item.label }}</span>
          </RouterLink>
        </template>
        <template v-else>
          <span itemprop="name">{{ item.label }}</span>
        </template>
        <meta itemprop="position" :content="String(idx + 1)" />
      </li>
    </ol>
  </nav>
</template>

<style scoped>
/* No view-specific styles. Presentation is handled by brand.css */
</style>
