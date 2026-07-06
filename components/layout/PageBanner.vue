<script setup>
defineProps({
  title: { type: String, required: true },
  lead: { type: String, default: '' },
})
</script>

<template>
  <header class="page-banner">
    <div class="page-banner__main">
      <div v-if="$slots.icon" class="page-banner__icon">
        <slot name="icon" />
      </div>
      <div class="page-banner__text">
        <h1 class="page-title">{{ title }}</h1>
        <p v-if="lead" class="page-banner__lead">{{ lead }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="page-banner__actions">
      <slot name="actions" />
    </div>
  </header>
</template>
