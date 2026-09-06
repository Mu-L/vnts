import { computed, reactive } from 'vue'

export type SettingsSectionId = 'access-control' | 'ikev2'
export type SettingsStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface SettingsSectionState {
  status: string
  tone: SettingsStatusTone
  dirty: boolean
}

const defaultState = (): SettingsSectionState => ({
  status: '正在读取',
  tone: 'neutral',
  dirty: false,
})

const sectionStates = reactive<Record<SettingsSectionId, SettingsSectionState>>({
  'access-control': defaultState(),
  ikev2: defaultState(),
})

const hasUnsavedChanges = computed(() =>
  Object.values(sectionStates).some((state) => state.dirty),
)

export function useSettingsNavigation() {
  function updateSectionState(section: SettingsSectionId, state: SettingsSectionState) {
    sectionStates[section] = state
  }

  return { sectionStates, hasUnsavedChanges, updateSectionState }
}
