<script setup>
import { Globe, Users, UserCheck } from 'lucide-vue-next'

defineProps({
  modelValue: { type: String, required: true }
})

const emit = defineEmits(['update:modelValue'])

const filters = [
  { id: 'public', label: 'สาธารณะ', icon: Globe },
  { id: 'following', label: 'ติดตาม', icon: UserCheck },
  { id: 'group', label: 'กลุ่ม', icon: Users }
]

function select(id) {
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="sub-tab-nav" role="tablist" aria-label="ประเภทฟีด">
    <button
      v-for="filter in filters"
      :key="filter.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === filter.id"
      class="sub-tab-btn"
      :class="modelValue === filter.id ? 'sub-tab-btn--active' : 'sub-tab-btn--inactive'"
      @click="select(filter.id)"
    >
      <component :is="filter.icon" class="w-3.5 h-3.5 shrink-0" />
      {{ filter.label }}
    </button>
  </div>
</template>
