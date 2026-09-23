<script setup lang="ts">
import { computed } from 'vue'
import { dotFills } from './rating'

const props = withDefaults(defineProps<{ value: number | null; size?: number; gap?: number; editable?: boolean }>(), {
  size: 9,
  gap: 3,
  editable: false,
})
const emit = defineEmits<{ set: [rating: number] }>()

const fills = computed(() => dotFills(props.value))
</script>

<template>
  <span class="lp-dots" :style="{ gap: `${gap}px` }">
    <template v-if="editable">
      <button
        v-for="(fill, i) in fills"
        :key="i"
        class="lp-dot lp-dot-btn"
        :class="fill"
        :style="{ width: `${size}px`, height: `${size}px` }"
        :aria-label="`Set confidence to ${i + 1}`"
        :title="`${i + 1}`"
        @click="emit('set', i + 1)"
      ></button>
    </template>
    <template v-else>
      <span
        v-for="(fill, i) in fills"
        :key="i"
        class="lp-dot"
        :class="fill"
        :style="{ width: `${size}px`, height: `${size}px` }"
      ></span>
    </template>
  </span>
</template>

<style scoped>
.lp-dots { display: inline-flex; flex-shrink: 0; }
.lp-dot { display: block; border-radius: 50%; background: var(--color-neutral-300); }
.lp-dot.full { background: var(--color-accent-600); }
.lp-dot.partial { background: var(--color-accent-300); }
.lp-dot-btn { border: none; padding: 0; cursor: pointer; }
.lp-dot-btn:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 25%, transparent); }
</style>
