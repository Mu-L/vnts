<script setup lang="ts">
import { Radio, ShieldCheck, Waves } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import Ikev2ServiceSettings from '@/components/Ikev2ServiceSettings.vue'
import NetworkAccessSettings from '@/components/NetworkAccessSettings.vue'
import WireGuardServiceSettings from '@/components/WireGuardServiceSettings.vue'
import { useSettingsNavigation } from '@/composables/useSettingsNavigation'
import type { SettingsSectionId } from '@/composables/useSettingsNavigation'

const route = useRoute()
const router = useRouter()
const { sectionStates, hasUnsavedChanges, updateSectionState } = useSettingsNavigation()

const sections = [
  { id: 'access-control' as const, label: '访问控制', description: '网络编码白名单', icon: ShieldCheck },
  { id: 'ikev2' as const, label: 'IKEv2 服务', description: '连接、端口与证书', icon: Radio },
  { id: 'wireguard' as const, label: 'WireGuard', description: 'UDP 接入与密钥', icon: Waves },
]

const activeSection = computed<SettingsSectionId>(() => route.query.section === 'ikev2' || route.query.section === 'wireguard' ? route.query.section : 'access-control')

function selectSection(section: SettingsSectionId) {
  if (section === activeSection.value) return
  void router.push({ query: { ...route.query, section } })
}

function confirmLeave() {
  return !hasUnsavedChanges.value || window.confirm('系统设置中还有未保存的修改，确定要离开吗？')
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

watch(
  () => route.query.section,
  (value) => {
    if (value === 'access-control' || value === 'ikev2' || value === 'wireguard') return
    void router.replace({ query: { ...route.query, section: 'access-control' } })
  },
  { immediate: true },
)

onBeforeRouteLeave(() => confirmLeave())
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-4 grid grid-cols-3 gap-2 lg:hidden" role="tablist" aria-label="设置分区">
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        role="tab"
        :aria-selected="activeSection === section.id"
        class="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition"
        :class="activeSection === section.id
          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-300'
          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'"
        @click="selectSection(section.id)"
      >
        <component :is="section.icon" :size="17" class="shrink-0" />
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ section.label }}</span>
        <span v-if="sectionStates[section.id].dirty" class="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="有未保存修改"></span>
      </button>
    </div>

    <main class="min-w-0">
      <NetworkAccessSettings v-show="activeSection === 'access-control'" @state="updateSectionState('access-control', $event)" />
      <Ikev2ServiceSettings v-show="activeSection === 'ikev2'" @state="updateSectionState('ikev2', $event)" />
      <WireGuardServiceSettings v-show="activeSection === 'wireguard'" @state="updateSectionState('wireguard', $event)" />
    </main>
  </div>
</template>
