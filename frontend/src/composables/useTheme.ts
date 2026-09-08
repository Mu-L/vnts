import { ref } from 'vue'

const THEME_KEY = 'vnt_theme'
const THEME_TRANSITION_MS = 160
let themeTransitionTimer: number | undefined
let themeTransitionEndHandler: ((event: TransitionEvent) => void) | undefined

export type Theme = 'light' | 'dark'

function storedTheme(): Theme | null {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(t: Theme) {
  theme.value = t
  document.documentElement.classList.toggle('dark', t === 'dark')
  document.documentElement.style.colorScheme = t
}

function cancelThemeTransitionCleanup(root: HTMLElement) {
  window.clearTimeout(themeTransitionTimer)
  themeTransitionTimer = undefined

  if (themeTransitionEndHandler) {
    root.removeEventListener('transitionend', themeTransitionEndHandler)
    themeTransitionEndHandler = undefined
  }
}

function finishThemeTransition(root: HTMLElement) {
  cancelThemeTransitionCleanup(root)
  root.classList.remove('theme-transitioning')
}

function applyThemeWithTransition(t: Theme) {
  const root = document.documentElement
  cancelThemeTransitionCleanup(root)
  root.classList.add('theme-transitioning')

  // 确保过渡规则先被浏览器应用，再切换 .dark，所有颜色属性会从同一帧开始过渡。
  void root.offsetWidth
  applyTheme(t)

  themeTransitionEndHandler = (event: TransitionEvent) => {
    if (event.target === root && event.propertyName === 'background-color') {
      finishThemeTransition(root)
    }
  }
  root.addEventListener('transitionend', themeTransitionEndHandler)

  // 页面不可见或浏览器不派发 transitionend 时仍能恢复普通交互过渡。
  themeTransitionTimer = window.setTimeout(() => {
    finishThemeTransition(root)
  }, THEME_TRANSITION_MS + 100)
}

// 模块级单例状态，各组件共享
const theme = ref<Theme>(storedTheme() ?? systemTheme())

applyTheme(theme.value)

export function useTheme() {
  function toggle() {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
    applyThemeWithTransition(next)
    localStorage.setItem(THEME_KEY, next)
  }

  return { theme, toggle }
}
