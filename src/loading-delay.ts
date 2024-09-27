import type { UseAsyncPlugin } from '@magic-js/use-async'
import type { MaybeFn } from '@rhao/types-base'
import { computed, type ComputedRef, watch } from '@vue/reactivity'
import { refDebounced } from '@vueuse/core'

export interface LoadingDelayPluginOptions {
  /**
   * 更改 `loading.value` 的延迟时间，单位：ms，如果值大于 0 则启动延迟，若请求在延迟前结束则不会更新 `loading.value`
   * @default 200
   */
  loadingDelay?: number
}

/**
 * 创建 LoadingDelayPlugin
 * @description 请求时延迟变更 `loading.value` 状态
 */
export function createLoadingDelayPlugin(
  pluginOptions: LoadingDelayPluginOptions = {},
): UseAsyncPlugin {
  const { loadingDelay: baseLoadingDelay = 200 } = pluginOptions

  return function LoadingDelayPlugin({ options, shell, hooks }) {
    const { loadingDelay = baseLoadingDelay } = options

    const debouncedLoading = refDebounced(shell.isExecuting, loadingDelay)
    watch(debouncedLoading, (value) => hooks.callHookSync('loading', value))

    shell.isLoading = computed(() => debouncedLoading.value)
  }
}

declare module '@magic-js/use-async' {
  // eslint-disable-next-line unused-imports/no-unused-vars
  interface UseAsyncOptions<T> {
    /**
     * 更改 `loading.value` 的延迟时间，单位：ms，如果值大于 0 则启动延迟，若请求在延迟前结束则不会更新 `loading.value`
     * @default LoadingDelayPluginOptions.loadingDelay
     */
    loadingDelay?: MaybeFn<number>
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  interface UseAsyncHooks<T> {
    /**
     * 变更 `loading.value` 时触发
     * @param value `loading.value` 状态
     */
    loading: (value: boolean) => void
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  interface UseAsyncReturn<T> {
    /**
     * 防抖版 `executing.value`，防抖时间以 `loadingDelay` 为准
     */
    isLoading: ComputedRef<boolean>
  }
}
