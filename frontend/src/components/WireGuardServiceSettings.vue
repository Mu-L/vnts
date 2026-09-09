<script setup lang="ts">
import { Clipboard, LoaderCircle, Radio, RotateCcw, Save } from '@lucide/vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
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
const form = reactive({ enabled: false, bind: '[::]:51820', endpoint: '', persistentKeepalive: 25 })
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-500/20'
const secondaryButtonClass = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'

function serializeForm() { return JSON.stringify(form) }
const hasChanges = computed(() => Boolean(savedSnapshot.value) && serializeForm() !== savedSnapshot.value)
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
  saveError.value = value.runtime_error ?? ''
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
  if (form.enabled && !form.endpoint.trim()) { toast.error('启用服务前请填写公开 Endpoint'); return }
  if (!Number.isInteger(form.persistentKeepalive) || form.persistentKeepalive < 0 || form.persistentKeepalive > 65535) { toast.error('Keepalive 必须为 0–65535'); return }
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
    toast.error(saveError.value)
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
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-6">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><Radio :size="21" /></div>
          <div><h2 class="font-semibold text-slate-950 dark:text-white">WireGuard 服务</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">独立 UDP 接入、公开地址与客户端 Keepalive。</p></div>
        </div>
        <span class="status-pill" :class="`status-${status.tone}`">{{ status.text }}</span>
      </div>
    </header>
    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
      <div v-if="loading" class="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle :size="17" class="animate-spin" />正在读取配置…</div>
      <div v-else class="space-y-5">
        <label class="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <span><span class="block text-sm font-semibold text-slate-800 dark:text-slate-200">启用 WireGuard</span><span class="mt-1 block text-xs text-slate-500">保存后立即启动或停止 UDP 服务。</span></span>
          <input v-model="form.enabled" type="checkbox" class="h-5 w-5 accent-blue-600" />
        </label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label><span class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">监听地址</span><input v-model.trim="form.bind" :class="inputClass" placeholder="[::]:51820" /></label>
          <label><span class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">PersistentKeepalive</span><input v-model.number="form.persistentKeepalive" type="number" min="0" max="65535" :class="inputClass" /></label>
        </div>
          <label><span class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">公开 Endpoint</span><div class="flex gap-2"><input v-model.trim="form.endpoint" :class="inputClass" placeholder="vpn.example.com:51820" /><button type="button" :class="secondaryButtonClass" @click="useCurrentHost">使用当前域名</button></div><span class="mt-1.5 block text-xs text-slate-400">填写客户端能够访问的域名/IP 和 UDP 端口。</span></label>
        <div v-if="info?.public_key" class="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/60"><div class="mb-1 text-xs font-medium text-slate-500">服务端公钥</div><div class="flex items-center gap-2"><code class="min-w-0 flex-1 break-all text-xs text-slate-700 dark:text-slate-300">{{ info.public_key }}</code><button type="button" :class="secondaryButtonClass" @click="copyPublicKey"><Clipboard :size="14" />复制</button></div></div>
        <p v-if="loadError || saveError" class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{{ loadError || saveError }}</p>
        <div class="flex justify-end gap-3"><button type="button" :class="secondaryButtonClass" :disabled="!hasChanges || saving" @click="resetChanges"><RotateCcw :size="15" />撤销</button><button type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!hasChanges || saving" @click="save"><LoaderCircle v-if="saving" :size="15" class="animate-spin" /><Save v-else :size="15" />保存</button></div>
      </div>
    </div>
  </section>
</template>
