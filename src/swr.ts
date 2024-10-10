import type {
  InferTaskPayload,
  InferTaskReturn,
  Task,
  UseAsyncOptions,
  UseAsyncPlugin,
  UseAsyncReturn,
} from '@magic-js/use-async'
import type { MaybeFn } from '@rhao/types-base'
import { triggerRef } from '@vue/reactivity'
import { tryOnScopeDispose } from '@vueuse/core'
import { isFunction, toValue } from 'nice-fns'

export interface SWROptions<T extends Task> {
  /**
   * 请求标识，相同标识的请求将会进行数据缓存和共享，若需根据参数匹配，则应在相同参数时返回同一标识
   */
  key: MaybeFn<string, InferTaskPayload<T>>
  /**
   * 缓存时间，单位：ms，设置大于 0 时有效
   */
  cacheTime: MaybeFn<number, InferTaskPayload<T>>
}

interface CacheContext {
  shell: UseAsyncReturn
  options: UseAsyncOptions
}

interface CacheModel {
  /**
   * 最后一次更新时间
   */
  lastUpdateTime: number | typeof EXPIRED_FLAG
  /**
   * 最近一次执行的任务
   */
  promise: Promise<any> | null
  /**
   * `useAsync()` 配置项和返回结果集合
   */
  contexts: CacheContext[]
}

const EXPIRED_FLAG = Symbol('expired flag')

function initCache() {
  return {
    lastUpdateTime: EXPIRED_FLAG,
    promise: null,
    contexts: [],
  } as CacheModel
}

function expireCache(cache: CacheModel | undefined) {
  if (cache) {
    cache.lastUpdateTime = EXPIRED_FLAG
    cache.promise = null
  }
}

function getKey({
  payload,
  options,
  shell,
}: {
  payload: any[]
  options: UseAsyncOptions
  shell: UseAsyncReturn
}) {
  // 1. 没有配置 key
  // 2. 没有执行记录并且 key 为函数
  if (
    !options.swr?.key
    || (isFunction(options.swr.key) && !shell.isFinished.value && !shell.isExecuting.value)
  ) {
    return null
  }

  return toValue(options.swr.key, ...payload)
}

function filterContextsByGetKey(contexts: CacheContext[]) {
  return contexts.filter(({ options, shell }) =>
    getKey({ options, shell, payload: shell.payload.value }),
  )
}

/**
 * 创建 SWRPlugin
 * @description SWR(stale-while-revalidate)
 */
export function createSWRPlugin(): UseAsyncPlugin {
  // 缓存集合
  const cacheMap = new Map<string, CacheModel>()

  return function SWRPlugin(pluginCtx) {
    const { task: rawTask, options: currentOptions, shell: currentShell, hooks } = pluginCtx

    // 判断是否为当前上下文
    const isCurrentContext = (context: CacheContext) => {
      return context.options === currentOptions && context.shell === currentShell
    }

    // #region 注册 triggerData()
    currentShell.triggerData = (containsSelf, syncData = true) => {
      if (containsSelf) {
        triggerRef(currentShell.data)
      }

      const key = getKey({
        options: currentOptions,
        shell: currentShell,
        payload: currentShell.payload.value,
      })

      if (key) {
        const cache = cacheMap.get(key)
        if (cache) {
          filterContextsByGetKey(cache.contexts).forEach((item) => {
            if (isCurrentContext(item)) {
              return
            }

            const { options, shell } = item
            const _key = getKey({
              options,
              shell,
              payload: shell.payload.value,
            })

            // 缓存键相同时执行 triggerRef
            if (_key === key) {
              const needTrigger = shell.data.value === currentShell.data.value && !syncData
              if (syncData) {
                shell.data.value = currentShell.data.value
              }
              if (needTrigger) {
                triggerRef(shell.data)
              }
            }
          })
        }
      }
    }
    // #endregion

    // #region 注册 markExpired()
    currentShell.markExpired = (...args: any[]) => {
      const hasArgs = args.length > 0
      const payload = hasArgs ? args : currentShell.payload.value

      const key = getKey({
        options: currentOptions,
        shell: currentShell,
        payload,
      })

      if (key) {
        expireCache(cacheMap.get(key))
      }
    }
    // #endregion

    // #region 注册 revalidate()
    currentShell.revalidate = (...args: any[]) => {
      const hasArgs = args.length > 0
      const payload = hasArgs ? args : currentShell.payload.value
      currentShell.markExpired(...payload)
      return currentShell.execute(...payload)
    }
    // #endregion

    const { cacheTime = 0 } = currentOptions.swr || {}

    // #region 注册 success 事件
    hooks.hook('success', ({ payload, rawData, data }) => {
      const key = getKey({
        options: currentOptions,
        shell: currentShell,
        payload,
      })

      if (!key) {
        return
      }

      const cache = cacheMap.get(key)
      // 第一次成功时更新 lastUpdateTime
      if (cache && cache.lastUpdateTime === EXPIRED_FLAG) {
        cache.lastUpdateTime = Date.now()
        // 更新其他没有正在执行的数据
        filterContextsByGetKey(cache.contexts).forEach((item) => {
          if (isCurrentContext(item))
            return

          const { options, shell } = item
          const _key = getKey({
            options,
            shell,
            payload: shell.payload.value,
          })

          if (key === _key) {
            shell.rawData.value = rawData
            shell.data.value = data
          }
        })
      }
    })
    // #endregion

    // #region 更改 task
    pluginCtx.task = (ctx) => {
      const key = getKey({
        options: currentOptions,
        shell: currentShell,
        payload: ctx.payload,
      })

      const cacheTimeValue = toValue(cacheTime, ...ctx.payload)
      if (!key || cacheTimeValue <= 0) {
        return rawTask(ctx)
      }

      // 获取缓存信息，没有时初始化
      let cache = cacheMap.get(key)
      if (!cache) {
        cache = initCache()
        cacheMap.set(key, cache)
      }

      // 验证缓存时间
      if (
        cache.lastUpdateTime !== EXPIRED_FLAG
        && Date.now() - cache.lastUpdateTime > cacheTimeValue
      ) {
        expireCache(cache)
      }

      // 缓存当前的上下文
      if (!cache.contexts.some(isCurrentContext)) {
        cache.contexts.push({ shell: currentShell, options: currentOptions })
      }

      // 存在 promise 时直接返回
      if (cache.promise) {
        return cache.promise
      }

      // 设置 promise，并且在失败时让缓存失效
      cache.promise = rawTask(ctx)
      cache.promise.catch(() => {
        expireCache(cache)
      })

      return cache.promise
    }
    // #endregion

    tryOnScopeDispose(() => {
      const deleteKeys: string[] = []
      for (const [key, cache] of cacheMap) {
        cache.contexts = cache.contexts.filter((item) => !isCurrentContext(item))
        if (cache.contexts.length === 0) {
          deleteKeys.push(key)
        }
      }
      deleteKeys.forEach((key) => cacheMap.delete(key))
    })
    // #endregion
  }
}

declare module '@magic-js/use-async' {
  interface UseAsyncOptions<T> {
    /**
     * SWR 配置项
     */
    swr?: SWROptions<T>
  }

  interface UseAsyncReturn<T> {
    /**
     * 由于 `data.value` 是 `ShallowRef`，数据变更视图未同步时需要手动执行 `triggerRef`，该方法用于执行相同缓存键的 `triggerRef`
     * @param containsSelf 执行时是否包含自身的 `data.value`，默认为 `false`
     * @param syncData 是否将当前的 `data.value` 同步到其他缓存上的 `data.value`，默认为 `true`，设为 `false` 时仅执行 `triggerRef`
     */
    triggerData: (containsSelf?: boolean, syncData?: boolean) => void
    /**
     * 标记已缓存数据过期
     * - `markExpired()`: 根据最近一次执行参数标记缓存过期
     * - `markExpired(...payload)`: 根据传入参数标记缓存过期
     */
    markExpired: {
      (): void
      (...payload: InferTaskPayload<T>): void
    }
    /**
     * 标记已缓存数据过期并重新执行任务获取有效数据
     * - `revalidate()`: `markExpired() -> reExecute()`
     * - `revalidate(...payload)`: `markExpired(...payload) -> execute(...payload)`
     */
    revalidate: {
      (): Promise<InferTaskReturn<T> | undefined>
      (...payload: InferTaskPayload<T>): Promise<InferTaskReturn<T> | undefined>
    }
  }
}
