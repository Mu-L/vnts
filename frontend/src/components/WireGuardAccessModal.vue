<script setup lang="ts">
import { Clipboard, Download, LoaderCircle, QrCode, ShieldAlert } from '@lucide/vue'
import QRCode from 'qrcode'
import { ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import { deviceApi } from '@/api/modules'
import { useToast } from '@/composables/useToast'
import type { DeviceWireGuardAccessInfo } from '@/types'
import { copyText } from '@/utils/clipboard'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ open: boolean; networkCode: string; deviceId: string }>()
const emit = defineEmits<{ close: [] }>()
const toast = useToast()
const loading = ref(false)
const info = ref<DeviceWireGuardAccessInfo | null>(null)
const qrDataUrl = ref('')
const qrError = ref(false)
let loadSequence = 0

async function load() {
  const sequence = ++loadSequence
  if (!props.open || !props.networkCode || !props.deviceId) {
    loading.value = false; info.value = null; qrDataUrl.value = ''; qrError.value = false
    return
  }
  loading.value = true; info.value = null; qrDataUrl.value = ''; qrError.value = false
  try {
    const accessInfo = await deviceApi.getWireGuardAccess(props.networkCode, props.deviceId)
    if (sequence !== loadSequence) return
    info.value = accessInfo
    try {
      const dataUrl = await QRCode.toDataURL(accessInfo.config, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
      if (sequence === loadSequence) qrDataUrl.value = dataUrl
    } catch {
      if (sequence === loadSequence) qrError.value = true
    }
  }
  catch (error) { toast.error(error instanceof ApiError ? error.message : '加载 WireGuard 接入配置失败') }
  finally { if (sequence === loadSequence) loading.value = false }
}
async function copyConfig() {
  if (!info.value) return
  try { await copyText(info.value.config); toast.success('WireGuard 配置已复制') }
  catch { toast.error('复制失败') }
}
function downloadConfig() {
  if (!info.value) return
  const blob = new Blob([info.value.config], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `${info.value.device_id}.conf`; anchor.click()
  URL.revokeObjectURL(url)
}
watch(() => [props.open, props.networkCode, props.deviceId], load, { immediate: true })
</script>

<template>
  <BaseModal :open="open" title="WireGuard 接入配置" wide @close="emit('close')">
    <div v-if="loading" class="flex items-center gap-2 py-10 text-sm text-slate-500"><LoaderCircle :size="17" class="animate-spin" />正在生成配置…</div>
    <div v-else-if="info" class="space-y-4">
      <div v-if="!info.service.enabled" class="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><ShieldAlert :size="18" class="shrink-0" />WireGuard 服务当前未启用，配置可下载但暂时无法连接。</div>
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60"><div class="text-xs text-slate-400">虚拟网段</div><div class="mt-1 font-medium text-slate-700 dark:text-slate-200">{{ info.network_net }}</div></div>
        <div class="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60"><div class="text-xs text-slate-400">Endpoint</div><div class="mt-1 break-all font-medium text-slate-700 dark:text-slate-200">{{ info.service.endpoint || '尚未配置' }}</div></div>
      </div>
      <div class="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <div class="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700">
          <div class="mb-3 flex items-center gap-1.5 self-start text-sm font-semibold text-slate-700 dark:text-slate-200"><QrCode :size="17" />扫码导入</div>
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="WireGuard 配置二维码" class="aspect-square w-full max-w-52 rounded bg-white" />
          <div v-else-if="qrError" class="flex aspect-square w-full max-w-52 items-center justify-center text-center text-xs text-rose-500">二维码生成失败，请复制或下载配置。</div>
          <p class="mt-3 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">使用 WireGuard 客户端的“扫描二维码”功能即可导入。</p>
        </div>
        <pre class="max-h-80 min-w-0 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{{ info.config }}</pre>
      </div>
      <p class="text-xs leading-5 text-amber-600 dark:text-amber-400">配置包含客户端私钥，请仅保存到可信设备，不要通过公开渠道分享。</p>
      <div class="flex justify-end gap-3"><button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700" @click="copyConfig"><Clipboard :size="15" />复制</button><button type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" @click="downloadConfig"><Download :size="15" />下载 .conf</button></div>
    </div>
    <div v-else class="py-8 text-center text-sm text-slate-400">未能加载接入配置。</div>
  </BaseModal>
</template>
