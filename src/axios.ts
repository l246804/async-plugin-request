import type { ExecuteContext, InferTaskReturn, UseAsyncPlugin } from '@magic-js/use-async'
import type { MaybeFn } from '@rhao/types-base'
import type { AxiosInstance, AxiosRequestConfig, AxiosStatic } from 'axios'
import axios from 'axios'
import { merge, toValue } from 'nice-fns'

interface PrivateStore {
  signal: AbortSignal
}

const PRIVATE_STORE_KEY = '_useAsyncAxiosPluginStore'

const onceMap = new WeakMap()
// 更改原型函数，执行任务时链接的上下文对象
let executingCtx: ExecuteContext.Before | null = null

patchAxios(axios.Axios)

/**
 * 为 Axios 原型链上的 request 方法进行补丁，链接 useRequest 配置项，
 * 默认的 Axios 已被自动补丁，若是存在多 Axios 的场景下可手动调用进行补丁
 *
 * @param Axios Axios
 *
 * @example
 * ```ts
 * import axios from 'axios'
 *
 * patchAxios(axios.Axios)
 * ```
 */
export function patchAxios(Axios: typeof axios.Axios) {
  if (onceMap.has(Axios)) {
    return
  }
  onceMap.set(Axios, true)

  // 原始的 `axios.request()`
  const originalRequest = Axios.prototype.request

  Axios.prototype.request = function request(
    configOrUrl: string | AxiosRequestConfig,
    config?: AxiosRequestConfig,
  ) {
    // 注册请求拦截器
    if (!onceMap.has(this)) {
      onceMap.set(this, true)

      this.interceptors.request.use((config) => {
        const store = config[PRIVATE_STORE_KEY] as PrivateStore
        if (store) {
          // 设置 config.signal
          if (!config.signal) {
            config.signal = store.signal
          }
        }
        return config
      })
    }

    if (typeof configOrUrl === 'string') {
      config = config || {}
      config.url = configOrUrl
    }
    else {
      config = configOrUrl || {}
    }

    // 链接 `useAsync()`
    if (executingCtx) {
      let ctx = executingCtx
      executingCtx = null

      config = merge({}, config, toValue(ctx.options.axiosConfig, this as AxiosInstance) || {})
      Object.assign(config, {
        [PRIVATE_STORE_KEY]: {
          signal: ctx.signal,
        } as PrivateStore,
      })

      // free mem
      ctx = null as any
    }

    return originalRequest.call(this, config) as any
  }
}

/**
 * 创建 AxiosPlugin
 * @description 链接 `useAsync(task)` 和 `axios()`，仅支持链接 `task` 内部同步执行的 `axios()` 请求
 */
export function createAxiosPlugin(): UseAsyncPlugin {
  return function AxiosPlugin(pluginCtx) {
    const { task: rawTask } = pluginCtx
    pluginCtx.task = (ctx) => {
      executingCtx = ctx
      const results = rawTask(ctx)
      executingCtx = null
      return results
    }
  }
}

declare module '@magic-js/use-async' {
  interface UseAsyncOptions<T> {
    /**
     * axios 配置项
     */
    axiosConfig?: MaybeFn<
      AxiosRequestConfig<InferTaskReturn<T>>,
      [axios: AxiosInstance | AxiosStatic]
    >
  }
}
