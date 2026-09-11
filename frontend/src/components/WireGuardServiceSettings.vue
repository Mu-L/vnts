<script setup lang="ts">
import { AlertCircle, Clipboard, LoaderCircle, Radio, RefreshCw, RotateCcw, Save } from '@lucide/vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import SettingsDisclosure from '@/components/SettingsDisclosure.vue'
import { settingsApi } from '@/api/modules'
import { useToast } from '@/composables/useToast'
import type { SettingsSectionState } from '@/composables/useSettingsNavigation'
import type { WireGuardServiceInfo } from '@/types'
import { copyText } from '@/utils/clipboard'

const emit = defineEmits<{ state: [value: SettingsSectionState] }>()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const info = ref<WireGuardServiceInfo | null>(null)
const savedSnapshot = ref('')
const savedAdvancedSnapshot = ref('')
const advancedOpen = ref(false)
const endpointInput = ref<HTMLInputElement | null>(null)
const keepaliveInput = ref<HTMLInputElement | null>(null)
const errorAlert = ref<HTMLElement | null>(null)
const form = reactive({ enabled: false, bind: '[::]:51820', endpoint: '', persistentKeepalive: 25 })
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-500/20'
const secondaryButtonClass = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'

function serializeForm() { return JSON.stringify(form) }
function serializeAdvanced() { return JSON.stringify({ bind: form.bind, persistentKeepalive: form.persistentKeepalive }) }
const hasChanges = computed(() => Boolean(savedSnapshot.value) && serializeForm() !== savedSnapshot.value)
const advancedDirty = computed(() => Boolean(savedAdvancedSnapshot.value) && serializeAdvanced() !== savedAdvancedSnapshot.value)
const advancedError = computed(() => Boolean(info.value?.runtime_error || saveError.value))
const advancedSummary = computed(() => `${form.bind} · Keepalive ${form.persistentKeepalive === 0 ? '关闭' : `${form.persistentKeepalive} 秒`}`)
const status = computed(() => {
  if (loadError.value) return { text: '加载失败', tone: 'danger' as const }
  if (info.value?.runtime_error || saveError.value) return { text: '运行异常', tone: 'danger' as const }
  if (info.value?.runtime_active) return { text: '运行中', tone: 'success' as const }
  if (loading.value) return { text: '正在读取', tone: 'neutral' as const }
  return { text: '未启用', tone: 'warning' as const }
})
watch([status, hasChanges], () => emit('state', { status: status.value.text, tone: status.value.tone, dirty: hasChanges.value }), { immediate: true })

function applyInfo(value: WireGuardServiceInfo) {
  info.value = value
  form.enabled = value.enabled
  form.bind = value.bind
  form.endpoint = value.endpoint
  form.persistentKeepalive = value.persistent_keepalive
  savedSnapshot.value = serializeForm()
  savedAdvancedSnapshot.value = serializeAdvanced()
  saveError.value = value.runtime_error ?? ''
  if (value.runtime_error) advancedOpen.value = true
}
async function load() {
  loading.value = true; loadError.value = ''
  try { applyInfo(await settingsApi.getWireGuard()) }
  catch (error) { loadError.value = error instanceof ApiError ? error.message : '无法读取 WireGuard 服务配置' }
  finally { loading.value = false }
}
function resetChanges() { if (info.value) applyInfo(info.value) }
function useCurrentHost() {
  if (!window.location.hostname) return
  const port = form.bind.split(':').at(-1) || '51820'
  form.endpoint = `${window.location.hostname}:${port}`
}
async function save() {
  if (!hasChanges.value || saving.value) return
  if (form.enabled && !form.endpoint.trim()) { toast.error('启用服务前请填写公开 Endpoint'); void nextTick(() => endpointInput.value?.focus()); return }
  if (!Number.isInteger(form.persistentKeepalive) || form.persistentKeepalive < 0 || form.persistentKeepalive > 65535) {
    advancedOpen.value = true
    toast.error('Keepalive 必须为 0–65535')
    void nextTick(() => keepaliveInput.value?.focus())
    return
  }
  saving.value = true; saveError.value = ''
  try {
    applyInfo(await settingsApi.updateWireGuard({
      enabled: form.enabled,
      bind: form.bind.trim(),
      endpoint: form.endpoint.trim(),
      persistent_keepalive: form.persistentKeepalive,
    }))
    toast.success(form.enabled ? 'WireGuard 配置已保存并生效' : 'WireGuard 服务已停用，配置已保留')
  } catch (error) {
    saveError.value = error instanceof ApiError ? error.message : '保存 WireGuard 配置失败'
    advancedOpen.value = true
    toast.error(saveError.value)
    void nextTick(() => errorAlert.value?.focus())
  } finally { saving.value = false }
}
async function copyPublicKey() {
  if (!info.value?.public_key) return
  try { await copyText(info.value.public_key); toast.success('服务端公钥已复制') }
  catch { toast.error('复制失败') }
}
onMounted(load)
</script>

<template>
  <section aria-labelledby="wireguard-title" class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><Radio :size="21" /></div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2"><h2 id="wireguard-title" class="font-semibold text-slate-950 dark:text-white">WireGuard 服务</h2><span class="status-pill" :class="`status-${status.tone}`">{{ status.text }}</span></div>
            <p class="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">为 WireGuard 客户端提供独立 UDP 接入。</p>
            <details class="help-details mt-2"><summary>如何配置</summary><p>启用前填写客户端能够访问的公开 Endpoint。监听地址和 Keepalive 通常保持默认值即可。</p></details>
          </div>
        </div>
        <label v-if="info" class="inline-flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">启用服务</span>
          <span class="relative inline-flex h-6 w-11 items-center rounded-full transition" :class="form.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'">
            <input v-model="form.enabled" type="checkbox" class="peer sr-only" />
            <span class="h-4 w-4 rounded-full bg-white shadow-sm transition-transform" :class="form.enabled ? 'translate-x-6' : 'translate-x-1'"></span>
          </span>
        </label>
      </div>
      <div v-if="saveError || info?.runtime_error" ref="errorAlert" tabindex="-1" class="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 outline-none dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle :size="18" class="mt-0.5 shrink-0" /><span>{{ saveError || info?.runtime_error }}</span></div>
    </header>
    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-label="正在加载 WireGuard 配置"><div class="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle :size="17" class="animate-spin" />正在读取配置…</div></div>
    <div v-else-if="loadError" class="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-500/30 dark:bg-slate-800">
      <AlertCircle :size="26" class="mx-auto text-red-500" /><h3 class="mt-3 font-semibold text-slate-900 dark:text-slate-100">WireGuard 配置加载失败</h3><p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{{ loadError }}</p>
      <button type="button" :class="secondaryButtonClass" class="mt-5" @click="load"><RefreshCw :size="15" />重新加载</button>
    </div>
    <div v-else-if="info" class="space-y-4">
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">基础设置</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">客户端连接时使用的公开地址。</p>
        <label class="mt-5 block"><span class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">公开 Endpoint</span><div class="flex flex-col gap-2 sm:flex-row"><input ref="endpointInput" v-model.trim="form.endpoint" :class="inputClass" placeholder="vpn.example.com:51820" /><button type="button" :class="secondaryButtonClass" @click="useCurrentHost">使用当前域名</button></div><span class="mt-1.5 block text-sm text-slate-500 dark:text-slate-400">包含客户端可访问的域名或 IP，以及 UDP 端口。</span></label>
      </section>

      <SettingsDisclosure v-model:open="advancedOpen" title="高级设置" :dirty="advancedDirty" :error="advancedError">
        <template #summary>{{ advancedSummary }}</template>
        <div class="grid gap-5 sm:grid-cols-2">
          <label><span class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">监听地址</span><input v-model.trim="form.bind" :class="inputClass" placeholder="[::]:51820" /><span class="mt-1.5 block text-sm text-slate-500 dark:text-slate-400">服务端接收 WireGuard 数据的本地地址。</span></label>
          <label><span class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">PersistentKeepalive</span><input ref="keepaliveInput" v-model.number="form.persistentKeepalive" type="number" min="0" max="65535" :class="inputClass" /><span class="mt-1.5 block text-sm text-slate-500 dark:text-slate-400">默认 25 秒；设为 0 表示关闭。</span></label>
        </div>
        <div v-if="info.public_key" class="mt-5 rounded-lg bg-slate-50 p-4 dark:bg-slate-900/60"><div class="mb-1 text-sm font-medium text-slate-500">服务端公钥</div><div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><code class="min-w-0 flex-1 break-all text-sm text-slate-700 dark:text-slate-300">{{ info.public_key }}</code><button type="button" :class="secondaryButtonClass" @click="copyPublicKey"><Clipboard :size="14" />复制</button></div></div>
      </SettingsDisclosure>

      <Transition name="action-bar">
        <div v-if="hasChanges" class="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-amber-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-amber-500/30 dark:bg-slate-800/95 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm font-medium text-amber-700 dark:text-amber-300">WireGuard 配置有未保存的修改</p>
          <div class="flex justify-end gap-2"><button type="button" :class="secondaryButtonClass" :disabled="saving" @click="resetChanges"><RotateCcw :size="15" />撤销</button><button type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" @click="save"><LoaderCircle v-if="saving" :size="15" class="animate-spin" /><Save v-else :size="15" />{{ saving ? '保存中...' : '保存并应用' }}</button></div>
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
@reference "../style.css";
.status-pill { @apply inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold; }
.status-neutral { @apply bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300; }
.status-success { @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300; }
.status-warning { @apply bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300; }
.status-danger { @apply bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300; }
.help-details summary { @apply inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300; }
.help-details summary::after { content: ''; @apply h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform; }
.help-details[open] summary::after { @apply rotate-[225deg]; }
.help-details p { @apply mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400; }
.action-bar-enter-active, .action-bar-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.action-bar-enter-from, .action-bar-leave-to { opacity: 0; transform: translateY(8px); }
</style>
