<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Globe2,
  KeyRound,
  LoaderCircle,
  Network,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
} from '@lucide/vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import SettingsDisclosure from '@/components/SettingsDisclosure.vue'
import { settingsApi } from '@/api/modules'
import { useToast } from '@/composables/useToast'
import type { SettingsSectionState } from '@/composables/useSettingsNavigation'
import type { Ikev2ServiceInfo, UpdateIkev2ServicePayload } from '@/types'

const emit = defineEmits<{ state: [value: SettingsSectionState] }>()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const savedSnapshot = ref('')
const info = ref<Ikev2ServiceInfo | null>(null)
const autoCertificate = ref(true)
const advancedOpen = ref(false)
const savedAdvancedSnapshot = ref('')
const serverAddressInput = ref<HTMLInputElement | null>(null)
const remoteIdInput = ref<HTMLInputElement | null>(null)
const certInput = ref<HTMLInputElement | null>(null)
const keyInput = ref<HTMLInputElement | null>(null)
const errorAlert = ref<HTMLElement | null>(null)
const form = reactive({ enabled: false, ikeBind: '[::]:500', nattBind: '[::]:4500', serverAddress: '', remoteId: '', dns: '', cert: '', key: '' })

const status = computed(() => {
  if (loadError.value) return { text: '加载失败', tone: 'danger' as const }
  if (loading.value) return { text: '正在读取', tone: 'neutral' as const }
  if (saving.value) return { text: '正在应用', tone: 'neutral' as const }
  if (saveError.value || info.value?.runtime_error) return { text: '启动失败', tone: 'danger' as const }
  if (!info.value?.enabled) return { text: '未启用', tone: 'neutral' as const }
  if (info.value.runtime_active) return { text: '运行中', tone: 'success' as const }
  return { text: '未运行', tone: 'warning' as const }
})
const certificateExpiry = computed(() => info.value?.certificate_not_after ? new Date(info.value.certificate_not_after * 1000).toLocaleDateString() : '未知')
const usesNonstandardPorts = computed(() => {
  const port = (address: string) => Number(address.match(/:(\d+)$/)?.[1])
  return port(form.ikeBind.trim()) !== 500 || port(form.nattBind.trim()) !== 4500
})

function serializeForm() {
  return JSON.stringify({ ...form, autoCertificate: autoCertificate.value })
}
function serializeAdvanced() {
  return JSON.stringify({ ikeBind: form.ikeBind, nattBind: form.nattBind, dns: form.dns, cert: form.cert, key: form.key, autoCertificate: autoCertificate.value })
}
const hasChanges = computed(() => Boolean(savedSnapshot.value) && serializeForm() !== savedSnapshot.value)
const advancedDirty = computed(() => Boolean(savedAdvancedSnapshot.value) && serializeAdvanced() !== savedAdvancedSnapshot.value)
const advancedError = computed(() => Boolean(saveError.value || info.value?.runtime_error))
const advancedSummary = computed(() => {
  const dns = form.dns.trim() ? form.dns.trim() : '自动 DNS'
  return `${form.ikeBind} / ${form.nattBind} · ${dns} · ${autoCertificate.value ? '自动证书' : '自定义证书'}`
})

watch([status, hasChanges], () => emit('state', { status: status.value.text, tone: status.value.tone, dirty: hasChanges.value }), { immediate: true })

function fillForm(value: Ikev2ServiceInfo) {
  form.enabled = value.enabled
  form.ikeBind = value.ike_bind
  form.nattBind = value.natt_bind
  form.serverAddress = value.server_address
  form.remoteId = value.remote_id
  form.dns = value.dns.join(', ')
  form.cert = value.cert ?? ''
  form.key = value.key ?? ''
  autoCertificate.value = !value.configured || value.certificate_managed || (!value.cert && !value.key)
}
function applyInfo(value: Ikev2ServiceInfo) {
  info.value = value
  fillForm(value)
  savedSnapshot.value = serializeForm()
  savedAdvancedSnapshot.value = serializeAdvanced()
  saveError.value = value.runtime_error ?? ''
  if (value.runtime_error) advancedOpen.value = true
}
async function load() {
  loading.value = true
  loadError.value = ''
  try { applyInfo(await settingsApi.getIkev2()) }
  catch (error) { loadError.value = error instanceof ApiError ? error.message : '无法读取 IKEv2 服务配置' }
  finally { loading.value = false }
}
function useCurrentHost() { if (window.location.hostname) form.serverAddress = window.location.hostname }
function resetChanges() {
  if (!info.value) return
  fillForm(info.value)
  saveError.value = info.value.runtime_error ?? ''
}
function validate() {
  if (form.enabled && !form.serverAddress.trim()) { toast.error('启用服务前必须填写服务器地址'); void nextTick(() => serverAddressInput.value?.focus()); return false }
  if (form.enabled && !form.remoteId.trim()) { toast.error('启用服务前必须填写远程 ID'); void nextTick(() => remoteIdInput.value?.focus()); return false }
  if (!autoCertificate.value && (!form.cert.trim() || !form.key.trim())) {
    advancedOpen.value = true
    toast.error('自定义证书模式必须同时填写证书链和私钥路径')
    void nextTick(() => (!form.cert.trim() ? certInput.value : keyInput.value)?.focus())
    return false
  }
  return true
}
async function save() {
  if (!hasChanges.value || !validate() || saving.value) return
  const payload: UpdateIkev2ServicePayload = {
    enabled: form.enabled,
    ike_bind: form.ikeBind.trim(),
    natt_bind: form.nattBind.trim(),
    server_address: form.serverAddress.trim(),
    remote_id: form.remoteId.trim(),
    dns: form.dns.split(/[,，\s]+/).map((value) => value.trim()).filter(Boolean),
    cert: autoCertificate.value ? undefined : form.cert.trim(),
    key: autoCertificate.value ? undefined : form.key.trim(),
  }
  saving.value = true
  saveError.value = ''
  try {
    applyInfo(await settingsApi.updateIkev2(payload))
    toast.success(form.enabled ? 'IKEv2/IPsec 配置已保存并生效' : 'IKEv2/IPsec 服务已停用，配置已保留')
  } catch (error) {
    saveError.value = error instanceof ApiError ? error.message : '保存 IKEv2 配置失败'
    advancedOpen.value = true
    toast.error(saveError.value)
    void nextTick(() => errorAlert.value?.focus())
  } finally { saving.value = false }
}
async function downloadCa(format: 'der' | 'pem') {
  try { await settingsApi.downloadIkev2Ca(format) }
  catch (error) { toast.error(error instanceof ApiError ? error.message : '下载 CA 证书失败') }
}
onMounted(load)
</script>

<template>
  <section aria-labelledby="ikev2-title" class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300"><ShieldCheck :size="21" /></div>
          <div>
            <div class="flex flex-wrap items-center gap-2"><h2 id="ikev2-title" class="font-semibold text-slate-950 dark:text-white">IKEv2/IPsec 服务</h2><span class="status-pill" :class="`status-${status.tone}`">{{ status.text }}</span></div>
            <p class="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">为系统原生 VPN 客户端提供安全接入。</p>
            <details class="help-details mt-2">
              <summary>如何配置</summary>
              <p>先填写客户端可访问的服务器地址和匹配证书的远程 ID。标准端口与自动证书适合大多数部署。</p>
            </details>
          </div>
        </div>
        <label v-if="info" class="inline-flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">启用服务</span>
          <span class="relative inline-flex h-6 w-11 items-center rounded-full transition" :class="form.enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'">
            <input v-model="form.enabled" type="checkbox" class="peer sr-only" />
            <span class="h-4 w-4 rounded-full bg-white shadow-sm transition-transform" :class="form.enabled ? 'translate-x-6' : 'translate-x-1'"></span>
          </span>
        </label>
      </div>
      <div v-if="saveError || info?.runtime_error" ref="errorAlert" tabindex="-1" class="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 outline-none dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle :size="18" class="mt-0.5 shrink-0" /><span>{{ saveError || info?.runtime_error }}</span></div>
    </header>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-label="正在加载 IKEv2 配置">
      <div class="animate-pulse space-y-5"><div class="grid gap-4 sm:grid-cols-2"><div class="h-24 rounded-lg bg-slate-100 dark:bg-slate-700/70"></div><div class="h-24 rounded-lg bg-slate-100 dark:bg-slate-700/70"></div></div><div class="h-28 rounded-lg bg-slate-100 dark:bg-slate-700/70"></div><div class="h-36 rounded-lg bg-slate-100 dark:bg-slate-700/70"></div></div>
    </div>

    <div v-else-if="loadError" class="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-500/30 dark:bg-slate-800">
      <AlertCircle :size="26" class="mx-auto text-red-500" /><h3 class="mt-3 font-semibold text-slate-900 dark:text-slate-100">IKEv2 配置加载失败</h3><p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{{ loadError }}</p>
      <button type="button" class="secondary-button mt-5" @click="load"><RefreshCw :size="15" />重新加载</button>
    </div>

    <div v-else-if="info" class="space-y-4">
      <section class="settings-card" aria-labelledby="identity-title">
        <div class="section-heading"><div class="section-icon"><Globe2 :size="18" /></div><div><h3 id="identity-title">基础设置</h3><p>客户端连接时必须使用的地址和服务器身份。</p></div></div>
        <div class="grid gap-5 md:grid-cols-2">
          <div><label for="ikev2-server-address" class="label">服务器地址</label><div class="mt-1.5 flex flex-col gap-2 sm:flex-row"><input id="ikev2-server-address" ref="serverAddressInput" v-model="form.serverAddress" class="field mt-0" placeholder="vpn.example.com 或 203.0.113.10" :required="form.enabled" /><button type="button" class="secondary-button" @click="useCurrentHost">使用当前地址</button></div><p class="hint">填写客户端能够访问的域名或 IP。</p></div>
          <div><label for="ikev2-remote-id" class="label">远程 ID</label><input id="ikev2-remote-id" ref="remoteIdInput" v-model="form.remoteId" class="field" placeholder="通常与服务器地址相同" :required="form.enabled" /><details class="help-details mt-2"><summary>远程 ID 是什么？</summary><p>用于校验证书中的服务器身份，必须与证书 SAN 完全匹配。</p></details></div>
        </div>
      </section>

      <SettingsDisclosure v-model:open="advancedOpen" title="高级设置" :dirty="advancedDirty" :error="advancedError">
        <template #summary>{{ advancedSummary }}</template>

        <div class="advanced-group">
          <div class="section-heading"><div class="section-icon"><Server :size="18" /></div><div><h3>监听端口</h3><p>服务端接收 IKE 协商与 NAT-T 数据的地址。</p></div></div>
          <div class="grid gap-5 md:grid-cols-2">
            <div><label for="ike-bind" class="label">IKE 监听地址</label><input id="ike-bind" v-model="form.ikeBind" class="field" placeholder="[::]:500" /><p class="hint">防火墙需放行 UDP 500。</p></div>
            <div><label for="natt-bind" class="label">NAT-T 监听地址</label><input id="natt-bind" v-model="form.nattBind" class="field" placeholder="[::]:4500" /><p class="hint">防火墙需放行 UDP 4500。</p></div>
          </div>
          <div v-if="usesNonstandardPorts" class="mt-4 flex gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3.5 py-3 text-sm leading-6 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300"><AlertCircle :size="18" class="mt-0.5 shrink-0" /><span>系统内置 VPN 客户端通常无法指定非 UDP 500/4500 端口，建议保持默认端口。</span></div>
        </div>

        <div class="advanced-group">
          <div class="section-heading"><div class="section-icon"><Network :size="18" /></div><div><h3>客户端网络</h3><p>连接后下发给客户端的可选 DNS。</p></div></div>
          <label for="ikev2-dns" class="label">客户端 DNS <span class="font-normal text-slate-400">（可选）</span></label><input id="ikev2-dns" v-model="form.dns" class="field" placeholder="1.1.1.1, 8.8.8.8" /><p class="hint">多个 IPv4 地址使用逗号或空格分隔。</p>
        </div>

        <div class="advanced-group border-b-0 pb-0">
          <div class="section-heading"><div class="section-icon"><KeyRound :size="18" /></div><div><h3>服务器证书</h3><p>自动管理是推荐选项，也可以使用已有证书。</p></div></div>
          <div role="radiogroup" aria-label="证书管理模式" class="grid gap-3 sm:grid-cols-2">
            <button type="button" role="radio" :aria-checked="autoCertificate" class="mode-card" :class="autoCertificate ? 'mode-card-active' : ''" @click="autoCertificate = true"><span class="mode-radio"><span v-if="autoCertificate"></span></span><span><strong>自动管理</strong><small>自动生成本地 CA，并续签服务器证书</small></span></button>
            <button type="button" role="radio" :aria-checked="!autoCertificate" class="mode-card" :class="!autoCertificate ? 'mode-card-active' : ''" @click="autoCertificate = false"><span class="mode-radio"><span v-if="!autoCertificate"></span></span><span><strong>自定义证书</strong><small>使用服务器上已有的证书链和私钥</small></span></button>
          </div>
          <div v-if="autoCertificate" class="mt-4 rounded-lg border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/25 dark:bg-cyan-500/5">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex gap-2.5"><CheckCircle2 :size="18" class="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-300" /><div><p class="text-sm font-semibold text-slate-800 dark:text-slate-200">证书由服务自动管理</p><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ info.certificate_managed ? `当前证书有效期至 ${certificateExpiry}` : '保存后将生成匹配远程 ID 的证书' }}</p></div></div>
              <div v-if="info.ca_download_available" class="flex shrink-0 flex-wrap gap-2"><button type="button" class="secondary-button" @click="downloadCa('der')"><Download :size="14" />下载 CA (.cer)</button><button type="button" class="secondary-button" @click="downloadCa('pem')">CA PEM</button></div>
            </div>
          </div>
          <div v-else class="mt-4 grid gap-5 md:grid-cols-2">
            <div><label for="cert-path" class="label">证书链路径</label><input id="cert-path" ref="certInput" v-model="form.cert" class="field" placeholder="/etc/vnts/ikev2-cert.pem" /><p class="hint">PEM 证书链，SAN 必须匹配远程 ID。</p></div>
            <div><label for="key-path" class="label">私钥路径</label><input id="key-path" ref="keyInput" v-model="form.key" class="field" placeholder="/etc/vnts/ikev2-key.pem" /><p class="hint">匹配证书的 PKCS#8 私钥。</p></div>
            <p v-if="info.certificate_configured && !info.certificate_managed" class="text-sm text-slate-500 dark:text-slate-400 md:col-span-2">当前自定义证书有效期至 {{ certificateExpiry }}；私有 CA 需要自行安装到客户端。</p>
          </div>
        </div>
      </SettingsDisclosure>
    </div>

    <Transition name="action-bar">
      <div v-if="hasChanges" class="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-amber-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-amber-500/30 dark:bg-slate-800/95 sm:flex-row sm:items-center sm:justify-between">
        <div><p class="text-sm font-medium text-amber-700 dark:text-amber-300">IKEv2 配置有未保存的修改</p><p v-if="info?.runtime_active" class="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">应用地址、身份或证书变更时，现有 IKEv2 会话需要重新连接。</p></div>
        <div class="flex shrink-0 justify-end gap-2"><button type="button" class="ghost-button" :disabled="saving" @click="resetChanges"><RotateCcw :size="15" />撤销</button><button type="button" class="primary-button" :disabled="saving" @click="save"><LoaderCircle v-if="saving" :size="15" class="animate-spin" /><Save v-else :size="15" />{{ saving ? '保存并应用中...' : '保存并应用' }}</button></div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
@reference "../style.css";
.settings-card { @apply rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6; }
.advanced-group { @apply mb-6 border-b border-slate-100 pb-6 dark:border-slate-700; }
.section-heading { @apply mb-5 flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-slate-700; }
.section-heading h3 { @apply text-sm font-semibold text-slate-950 dark:text-white; }
.section-heading p { @apply mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400; }
.section-icon { @apply flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300; }
.label { @apply text-sm font-medium text-slate-700 dark:text-slate-300; }
.field { @apply mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/20; }
.hint { @apply mt-1.5 text-[13px] leading-5 text-slate-500 dark:text-slate-400; }
.status-pill { @apply inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold; }
.status-neutral { @apply bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300; }
.status-success { @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300; }
.status-warning { @apply bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300; }
.status-danger { @apply bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300; }
.secondary-button { @apply inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700; }
.ghost-button { @apply inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700; }
.primary-button { @apply inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50; }
.mode-card { @apply flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-left transition hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500; }
.mode-card-active { @apply border-cyan-500 bg-cyan-50/60 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-500/5 dark:ring-cyan-400; }
.mode-card strong { @apply block text-sm font-semibold text-slate-800 dark:text-slate-200; }
.mode-card small { @apply mt-1 block text-[13px] leading-5 text-slate-500 dark:text-slate-400; }
.mode-radio { @apply mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-500; }
.mode-radio span { @apply h-2 w-2 rounded-full bg-cyan-600 dark:bg-cyan-400; }
.help-details summary { @apply inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300; }
.help-details summary::after { content: ''; @apply h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform; }
.help-details[open] summary::after { @apply rotate-[225deg]; }
.help-details p { @apply mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400; }
.action-bar-enter-active, .action-bar-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.action-bar-enter-from, .action-bar-leave-to { opacity: 0; transform: translateY(8px); }
</style>
