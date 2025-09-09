<script setup>
import { RouterLink } from 'vue-router';

const props = defineProps({
  // items: [{ label: string, to?: string | object, disabled?: boolean }]
  // When item.disabled === true, treat item as non-interactive, even if `to` is provided
  items: { type: Array, required: true },
  // aria-label for the <nav>
  ariaLabel: { type: String, default: 'breadcrumb' },
});

function isLast(idx) {
  return idx === (props.items?.length || 0) - 1;
}
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
        :aria-current="isLast(idx) ? 'page' : null"
        :aria-disabled="!isLast(idx) && item?.disabled ? 'true' : null"
        itemprop="itemListElement"
        itemscope
        itemtype="https://schema.org/ListItem"
      >
        <template v-if="!isLast(idx) && item.to && !item.disabled">
          <RouterLink :to="item.to" itemprop="item">
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
