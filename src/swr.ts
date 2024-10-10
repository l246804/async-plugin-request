import type {
  InferTaskPayload,
  InferTaskReturn,
  Task,
  UseAsyncOptions,
  UseAsyncPlugin,
  UseAsyncReturn,
} from '@magic-js/use-async'
import type { MaybeFn } from '@rhao/types-base'
import { tryOnScopeDispose } from '@vueuse/core'
import { toValue } from 'nice-fns'

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
  contexts: {
    shell: UseAsyncReturn
    options: UseAsyncOptions
  }[]
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
  // 1. 没有执行记录
  // 2. 没有配置 key
  if ((!shell.isFinished.value && !shell.isExecuting.value) || !options.swr?.key) {
    return null
  }

  return toValue(options.swr.key, ...payload)
}

/**
 * 创建 SWRPlugin
 * @description SWR(stale-while-revalidate)
 */
export function createSWRPlugin(): UseAsyncPlugin {
  // 缓存集合
  const cacheMap = new Map<string, CacheModel>()

  return function SWRPlugin(pluginCtx) {
    const { task: rawTask, options, shell, hooks } = pluginCtx

    // #region 过滤非自身的缓存上下文集合
    type Predicate = (item: { shell: UseAsyncReturn, options: UseAsyncOptions }) => boolean
    function filterContexts(cache: CacheModel, predicate: Predicate = () => true) {
      return cache.contexts.filter(
        (item) => item.shell !== shell && item.options !== options && predicate(item),
      )
    }
    // #endregion

    // #region 注册 markExpired()
    shell.markExpired = (...args: any[]) => {
      const hasArgs = args.length > 0
      const payload = hasArgs ? args : shell.payload.value
      const key = getKey({ options, payload, shell })
      if (key) {
        expireCache(cacheMap.get(key))
      }
    }
    // #endregion

    // #region 注册 revalidate()
    shell.revalidate = (...args: any[]) => {
      const hasArgs = args.length > 0
      const payload = hasArgs ? args : shell.payload.value
      shell.markExpired(...payload)
      return shell.execute(...payload)
    }
    // #endregion

    const { cacheTime = 0 } = options.swr || {}

    // #region 注册 success 事件
    hooks.hook('success', ({ payload, rawData, data }) => {
      const key = getKey({ options, payload, shell })
      if (!key)
        return

      const cache = cacheMap.get(key)
      // 第一次成功时更新 lastUpdateTime
      if (cache && cache.lastUpdateTime === EXPIRED_FLAG) {
        cache.lastUpdateTime = Date.now()
        // 更新其他没有正在执行的数据
        filterContexts(
          cache,
          ({ shell }) => shell.isFinished.value && !shell.isExecuting.value,
        ).forEach(({ shell, options }) => {
          const _key = getKey({ options, payload: shell.payload.value, shell })
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
      const key = getKey({ options, payload: ctx.payload, shell })
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

      // 注册缓存上下文
      cache.contexts = filterContexts(cache).concat({ shell, options })

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
        cache.contexts = filterContexts(cache)
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
