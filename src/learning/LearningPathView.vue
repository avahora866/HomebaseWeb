<script setup lang="ts">
import { ref } from 'vue'
import FieldsOverview from './FieldsOverview.vue'
import SpecialisationView from './SpecialisationView.vue'

// The overview remounts (and so reloads) on the way back, picking up any ratings changed meanwhile.
const specialisationId = ref<number | null>(null)
</script>

<template>
  <SpecialisationView
    v-if="specialisationId !== null"
    :key="specialisationId"
    :specialisation-id="specialisationId"
    @back="specialisationId = null"
  />
  <FieldsOverview v-else @open="specialisationId = $event" />
</template>
