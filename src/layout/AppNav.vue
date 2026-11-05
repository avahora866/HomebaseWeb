<script setup lang="ts">
defineProps<{ active: 'finance' | 'projects' | 'research' | 'settings' }>()
const emit = defineEmits<{ navigate: [view: 'finance' | 'projects' | 'research' | 'settings'] }>()
</script>

<template>
  <div class="app-nav">
    <span class="brand">
      <svg class="brand-mark" viewBox="0 0 56 39" aria-hidden="true">
        <rect x="14" y="0" width="28" height="8" fill="currentColor" />
        <rect x="7" y="13" width="42" height="8" fill="currentColor" />
        <rect x="0" y="26" width="56" height="13" fill="#178a4f" />
      </svg>
      Homebase
    </span>
    <button class="app-nav-link" :class="{ active: active === 'finance' }" @click="emit('navigate', 'finance')">
      Finance
    </button>
    <button class="app-nav-link" :class="{ active: active === 'projects' }" @click="emit('navigate', 'projects')">
      Projects
    </button>
    <button class="app-nav-link" :class="{ active: active === 'research' }" @click="emit('navigate', 'research')">
      Research
    </button>
    <button
      class="app-nav-settings"
      :class="{ active: active === 'settings' }"
      aria-label="Settings"
      title="Settings"
      @click="emit('navigate', 'settings')"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-neutral-300);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: 18px;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin-right: var(--space-4);
}
.brand-mark {
  width: 26px;
  height: 18px;
  flex-shrink: 0;
}
.app-nav-link {
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--color-neutral-600);
  background: none;
  border: none;
  padding: var(--space-2) 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.app-nav-link:hover { color: var(--color-text); }
.app-nav-link.active { color: var(--color-text); border-bottom-color: var(--color-accent); }
.app-nav-link:disabled { cursor: not-allowed; opacity: 0.45; }
.app-nav-link:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

.app-nav-settings {
  margin-left: auto;
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: var(--space-2);
  color: var(--color-neutral-600);
  cursor: pointer;
  border-radius: var(--radius-md);
}
.app-nav-settings:hover { color: var(--color-text); background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.app-nav-settings.active { color: var(--color-accent); }
.app-nav-settings:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
</style>
