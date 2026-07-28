<script setup lang="ts"></script>

<template>
  <div class="app-nav">
    <span class="brand">Homebase</span>
    <button class="app-nav-link" disabled title="Not part of this redesign">Tasks</button>
    <button class="app-nav-link" disabled title="Not part of this redesign">Audit</button>
    <button class="app-nav-link" disabled title="Not part of this redesign">Workout</button>
    <button class="app-nav-link active">Finance</button>
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
  font-family: var(--font-heading);
  font-size: 18px;
  margin-right: var(--space-4);
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
</style>
