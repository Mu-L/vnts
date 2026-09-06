<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import { networkApi, settingsApi } from '@/api/modules'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import type { SettingsSectionState } from '@/composables/useSettingsNavigation'

const emit = defineEmits<{
  state: [value: SettingsSectionState]
}>()

const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const confirmClearOpen = ref(false)
const savedCodes = ref<string[]>([])
const codes = ref<string[]>([])
const existingCodes = ref<string[]>([])
const input = ref('')

const hasChanges = computed(() => {
  if (codes.value.length !== savedCodes.value.length) return true
  const saved = new Set(savedCodes.value)
  return codes.value.some((code) => !saved.has(code))
})

const availableSuggestions = computed(() => {
  const selected = new Set(codes.value)
  const query = input.value.trim().toLowerCase()
  return existingCodes.value.filter(
    (code) => !selected.has(code) && (!query || code.toLowerCase().includes(query)),
  )
})

const status = computed(() => {
  if (loadError.value) return { text: '加载失败', tone: 'danger' as const }
  if (loading.value) return { text: '正在读取', tone: 'neutral' as const }
  if (codes.value.length === 0) return { text: '允许所有网络', tone: 'warning' as const }
  return { text: `限制 ${codes.value.length} 个网络`, tone: 'success' as const }
})

watch(
  [status, hasChanges],
  () => emit('state', { status: status.value.text, tone: status.value.tone, dirty: hasChanges.value }),
  { immediate: true },
)

async function loadSettings() {
  loading.value = true
  loadError.value = ''
  try {
    const [settings, networkCodes] = await Promise.all([
      settingsApi.getNetworkWhitelist(),
      networkApi.codes(),
    ])
    savedCodes.value = [...settings.network_codes]
    codes.value = [...settings.network_codes]
    existingCodes.value = [...networkCodes].sort()
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : '无法读取网络访问策略'
  } finally {
    loading.value = false
  }
}

function addCode(rawCode: string) {
  const code = rawCode.trim()
  if (!code) return
  if (new TextEncoder().encode(code).length > 32) {
    toast.error(`网络编码“${code}”超过 32 字节`)
    return
  }
  if (!codes.value.includes(code)) codes.value.push(code)
}

function addTokens(raw: string) {
  raw.split(/[,，\n\r]+/).forEach(addCode)
  input.value = ''
}

function commitInput() {
  addTokens(input.value)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ',' && event.key !== '，') return
  event.preventDefault()
  commitInput()
}

function handlePaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/[,，\n\r]/.test(text)) return
  event.preventDefault()
  addTokens(text)
}

function removeCode(code: string) {
  codes.value = codes.value.filter((item) => item !== code)
}

function resetChanges() {
  codes.value = [...savedCodes.value]
  input.value = ''
}

function requestSave() {
  commitInput()
  if (!hasChanges.value || saving.value) return
  if (savedCodes.value.length > 0 && codes.value.length === 0) {
    confirmClearOpen.value = true
    return
  }
  void saveSettings()
}

async function saveSettings() {
  if (saving.value) return
  saving.value = true
  try {
    const settings = await settingsApi.updateNetworkWhitelist({ network_codes: [...codes.value] })
    savedCodes.value = [...settings.network_codes]
    codes.value = [...settings.network_codes]
    confirmClearOpen.value = false
    toast.success('网络访问策略已保存')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : '保存网络访问策略失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <section aria-labelledby="access-control-title" class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <ShieldCheck :size="21" />
          </div>
          <div>
            <h2 id="access-control-title" class="font-semibold text-slate-950 dark:text-white">网络访问控制</h2>
            <p class="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">决定哪些网络编码可以连接到当前服务实例。</p>
          </div>
        </div>
        <span class="status-pill" :class="`status-${status.tone}`">{{ status.text }}</span>
      </div>
    </header>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-label="正在加载访问控制设置">
      <div class="animate-pulse space-y-5">
        <div class="h-20 rounded-lg bg-slate-100 dark:bg-slate-700/70"></div>
        <div class="h-10 rounded-lg bg-slate-100 dark:bg-slate-700/70"></div>
        <div class="h-32 rounded-lg bg-slate-100 dark:bg-slate-700/70"></div>
      </div>
    </div>

    <div v-else-if="loadError" class="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-500/30 dark:bg-slate-800">
      <AlertCircle :size="26" class="mx-auto text-red-500" />
      <h3 class="mt-3 font-semibold text-slate-900 dark:text-slate-100">访问策略加载失败</h3>
      <p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{{ loadError }}</p>
      <button type="button" class="secondary-button mt-5" @click="loadSettings">
        <RefreshCw :size="15" />重新加载
      </button>
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div class="border-b border-slate-100 p-5 dark:border-slate-700 sm:p-6">
        <div class="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <span class="step-number">1</span>当前策略
        </div>
        <div
          class="flex gap-3 rounded-lg border px-4 py-3.5"
          :class="codes.length === 0
            ? 'border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/5'
            : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-500/5'"
        >
          <Info v-if="codes.length === 0" :size="18" class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <CheckCircle2 v-else :size="18" class="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {{ codes.length === 0 ? '允许所有网络连接' : `仅允许列表中的 ${codes.length} 个网络连接` }}
            </p>
            <p class="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">保存后立即影响新连接和重连，不会断开当前在线设备。</p>
          </div>
        </div>
      </div>

      <div class="border-b border-slate-100 p-5 dark:border-slate-700 sm:p-6">
        <div class="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <span class="step-number">2</span>添加网络编码
        </div>
        <label for="whitelist-code" class="sr-only">网络编码</label>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            id="whitelist-code"
            v-model="input"
            type="text"
            list="network-code-suggestions"
            maxlength="32"
            class="field min-w-0 flex-1"
            placeholder="输入网络编码，按 Enter 添加"
            @keydown="handleKeydown"
            @paste="handlePaste"
          />
          <datalist id="network-code-suggestions">
            <option v-for="code in availableSuggestions" :key="code" :value="code" />
          </datalist>
          <button type="button" class="secondary-button sm:self-stretch" :disabled="!input.trim()" @click="commitInput">
            <Plus :size="16" />添加
          </button>
        </div>
        <p class="mt-2 text-[13px] leading-5 text-slate-500 dark:text-slate-400">支持粘贴以逗号或换行分隔的多个编码，单个编码最多 32 字节。</p>
        <div v-if="availableSuggestions.length && !input" class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-[13px] text-slate-400 dark:text-slate-500">已有网络：</span>
          <button
            v-for="code in availableSuggestions.slice(0, 6)"
            :key="code"
            type="button"
            class="rounded-md bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
            @click="addCode(code)"
          >
            + {{ code }}
          </button>
        </div>
      </div>

      <div class="p-5 sm:p-6">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span class="step-number">3</span>允许列表
          </div>
          <span class="text-[13px] text-slate-400 dark:text-slate-500">{{ codes.length }} 项</span>
        </div>
        <div v-if="codes.length === 0" class="rounded-lg border border-dashed border-slate-300 px-4 py-9 text-center dark:border-slate-600">
          <ShieldCheck :size="24" class="mx-auto text-slate-300 dark:text-slate-600" />
          <p class="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">白名单为空</p>
          <p class="mt-1 text-[13px] text-slate-400 dark:text-slate-500">当前服务不会按网络编码限制连接。</p>
        </div>
        <div v-else class="flex min-h-24 flex-wrap content-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-600 dark:bg-slate-900/40">
          <span v-for="code in codes" :key="code" class="code-chip">
            {{ code }}
            <button type="button" class="rounded p-0.5 transition hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-500/20 dark:hover:text-blue-100" :aria-label="`移除 ${code}`" @click="removeCode(code)">
              <X :size="13" />
            </button>
          </span>
        </div>
      </div>
    </div>

    <Transition name="action-bar">
      <div v-if="hasChanges" class="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-amber-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-amber-500/30 dark:bg-slate-800/95 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-medium text-amber-700 dark:text-amber-300">访问策略有未保存的修改</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="ghost-button" :disabled="saving" @click="resetChanges"><RotateCcw :size="15" />撤销</button>
          <button type="button" class="primary-button" :disabled="saving" @click="requestSave">
            <LoaderCircle v-if="saving" :size="15" class="animate-spin" />
            <Save v-else :size="15" />{{ saving ? '保存中...' : '保存策略' }}
          </button>
        </div>
      </div>
    </Transition>

    <ConfirmDialog
      :open="confirmClearOpen"
      message="确定要清空网络编码白名单吗？清空后将允许任意网络编码的新连接和重连。"
      confirm-text="确认清空"
      :loading="saving"
      @close="confirmClearOpen = false"
      @confirm="saveSettings"
    />
  </section>
</template>

<style scoped>
@reference "../style.css";
.field { @apply w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:ring-blue-500/20; }
.step-number { @apply inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300; }
.status-pill { @apply inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold; }
.status-neutral { @apply bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300; }
.status-success { @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300; }
.status-warning { @apply bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300; }
.status-danger { @apply bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300; }
.secondary-button { @apply inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700; }
.ghost-button { @apply inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700; }
.primary-button { @apply inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50; }
.code-chip { @apply inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-sm font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300; }
.action-bar-enter-active, .action-bar-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.action-bar-enter-from, .action-bar-leave-to { opacity: 0; transform: translateY(8px); }
</style>
