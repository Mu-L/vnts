<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  title: string
  dirty?: boolean
  error?: boolean
}>(), {
  open: false,
  dirty: false,
  error: false,
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const toggle = ref<HTMLButtonElement | null>(null)
const panelId = `settings-disclosure-${Math.random().toString(36).slice(2)}`
const stateLabel = computed(() => props.error ? '需要处理' : props.dirty ? '有未保存修改' : '')

function focusToggle() {
  toggle.value?.focus()
}

defineExpose({ focusToggle })
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <button
      ref="toggle"
      type="button"
      class="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-700/40 sm:px-6"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="emit('update:open', !open)"
    >
      <span class="min-w-0 flex-1">
        <span class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ title }}</span>
          <span v-if="stateLabel" class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="error ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'">
            {{ stateLabel }}
          </span>
        </span>
        <span v-if="!open" class="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">
          <slot name="summary" />
        </span>
      </span>
      <ChevronDown :size="18" class="shrink-0 text-slate-400 transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <div v-show="open" :id="panelId" class="border-t border-slate-100 px-5 py-5 dark:border-slate-700 sm:px-6 sm:py-6">
      <slot />
    </div>
  </section>
</template>
