<script setup lang="ts">
import { ChevronDown, LogOut, Network, Radio, Server, Settings, ShieldCheck, Waves } from '@lucide/vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from './AppLogo.vue'
import { useAuthStore } from '@/composables/useAuth'
import { useSettingsNavigation } from '@/composables/useSettingsNavigation'

const { username, logout } = useAuthStore()
const { sectionStates } = useSettingsNavigation()
const route = useRoute()
const router = useRouter()
const settingsActive = computed(() => route.name === 'settings')
const activeSettingsSection = computed(() => route.query.section === 'ikev2' || route.query.section === 'wireguard' ? route.query.section : 'access-control')

function handleLogout() {
  logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <aside class="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
    <div class="flex h-16 items-center border-b border-slate-100 dark:border-slate-800 px-5">
      <AppLogo />
    </div>

    <nav class="flex-1 space-y-1 px-3 py-4">
      <RouterLink
        to="/networks"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        active-class="!bg-blue-50 !font-semibold !text-blue-700 dark:!bg-blue-500/15 dark:!text-blue-400"
      >
        <Network :size="18" />
        网络管理
      </RouterLink>
      <RouterLink
        to="/servers"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        active-class="!bg-blue-50 !font-semibold !text-blue-700 dark:!bg-blue-500/15 dark:!text-blue-400"
      >
        <Server :size="18" />
        服务器列表
      </RouterLink>
      <div>
        <RouterLink
          :to="{ name: 'settings', query: { section: 'access-control' } }"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          active-class="!bg-blue-50 !font-semibold !text-blue-700 dark:!bg-blue-500/15 dark:!text-blue-400"
        >
          <Settings :size="18" />
          <span class="flex-1">系统设置</span>
          <ChevronDown :size="15" class="transition-transform" :class="settingsActive ? 'rotate-0' : '-rotate-90'" />
        </RouterLink>

        <Transition name="submenu">
          <div v-if="settingsActive" class="relative ml-5 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-700">
            <RouterLink
              :to="{ name: 'settings', query: { section: 'access-control' } }"
              class="settings-submenu-item"
              :class="activeSettingsSection === 'access-control' ? 'settings-submenu-active' : ''"
            >
              <ShieldCheck :size="15" class="shrink-0" />
              <span class="min-w-0 flex-1 truncate">访问控制</span>
              <span v-if="sectionStates['access-control'].dirty" class="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="有未保存修改"></span>
            </RouterLink>
            <RouterLink
              :to="{ name: 'settings', query: { section: 'ikev2' } }"
              class="settings-submenu-item"
              :class="activeSettingsSection === 'ikev2' ? 'settings-submenu-active' : ''"
            >
              <Radio :size="15" class="shrink-0" />
              <span class="min-w-0 flex-1 truncate">IKEv2 服务</span>
              <span v-if="sectionStates.ikev2.dirty" class="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="有未保存修改"></span>
            </RouterLink>
            <RouterLink
              :to="{ name: 'settings', query: { section: 'wireguard' } }"
              class="settings-submenu-item"
              :class="activeSettingsSection === 'wireguard' ? 'settings-submenu-active' : ''"
            >
              <Waves :size="15" class="shrink-0" />
              <span class="min-w-0 flex-1 truncate">WireGuard 服务</span>
              <span v-if="sectionStates.wireguard.dirty" class="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="有未保存修改"></span>
            </RouterLink>
          </div>
        </Transition>
      </div>
    </nav>

    <div class="border-t border-slate-100 dark:border-slate-800 p-3">
      <div class="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
        >
          {{ (username || 'A').charAt(0).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{{ username || 'Admin' }}</div>
          <div class="text-[11px] text-slate-400 dark:text-slate-500">管理员</div>
        </div>
        <button
          class="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          title="退出登录"
          @click="handleLogout"
        >
          <LogOut :size="16" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
@reference "../style.css";
.settings-submenu-item { @apply flex min-h-9 items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200; }
.settings-submenu-active { @apply bg-slate-100 font-semibold text-blue-700 dark:bg-slate-800 dark:text-blue-400; }
.submenu-enter-active, .submenu-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.submenu-enter-from, .submenu-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
