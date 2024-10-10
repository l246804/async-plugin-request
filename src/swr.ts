import type {
  InferTaskPayload,
  InferTaskReturn,
  UseAsyncOptions,
  UseAsyncPlugin,
  UseAsyncReturn,
} from '@magic-js/use-async'
import type { MaybeFn } from '@rhao/types-base'
import { tryOnScopeDispose } from '@vueuse/core'
import { toValue } from 'nice-fns'

export interface SWRPluginOptions {
  /**
   * 数据缓存时间，单位：ms，仅在初始值大于 0 时开启
   * @default 0
   */
  cacheTime?: number
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
  contexts: { shell: UseAsyncReturn, options: UseAsyncOptions }[]
}

function getKey(options: UseAsyncOptions, payload: any[]) {
  return options.swr?.key ? toValue(options.swr.key, payload) : null
}

const EXPIRED_FLAG = Symbol('expired flag')

function isValid(cache: CacheModel | undefined, cacheTime: number) {
  return (
    cacheTime > 0
    && !!cache
    && cache.lastUpdateTime !== EXPIRED_FLAG
    && Date.now() - cache.lastUpdateTime < cacheTime
  )
}

function initCache() {
  return { lastUpdateTime: EXPIRED_FLAG, promise: null, contexts: [] } as CacheModel
}

function expireCache(cache: CacheModel | undefined) {
  if (cache) {
    cache.lastUpdateTime = EXPIRED_FLAG
    cache.promise = null
  }
}

/**
 * 创建 SWRPlugin
 * @description SWR(stale-while-revalidate)
 */
export function createSWRPlugin(pluginOptions: SWRPluginOptions = {}): UseAsyncPlugin {
  const { cacheTime: baseCacheTime = 0 } = pluginOptions

  const cacheMap = new Map<string, CacheModel>()
  return function SWRPlugin(pluginCtx) {
    const { task: rawTask, options, shell, hooks } = pluginCtx

    type Predicate = (item: { shell: UseAsyncReturn, options: UseAsyncOptions }) => boolean
    function otherContexts(cache: CacheModel, predicate: Predicate = () => true) {
      return cache.contexts.filter(
        (item) => item.shell !== shell && item.options !== options && predicate(item),
      )
    }

    // #region 注册 markExpired()
    shell.markExpired = (...args: any[]) => {
      const hasArgs = args.length > 0
      const payload = hasArgs ? args : shell.payload.value
      const key = getKey(options, payload)
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

    const { cacheTime = baseCacheTime } = options.swr || {}

    // #region 注册 success 事件
    hooks.hook('success', ({ payload, rawData, data }) => {
      const key = getKey(options, payload)
      if (!key)
        return

      const cache = cacheMap.get(key)
      if (cache && cache.lastUpdateTime === EXPIRED_FLAG) {
        cache.lastUpdateTime = Date.now()
        // 更新其他没有正在执行的数据
        otherContexts(cache, ({ shell }) => !shell.isExecuting.value).forEach(
          ({ shell, options }) => {
            const _key = getKey(options, shell.payload.value)
            if (key === _key) {
              shell.rawData.value = rawData
              shell.data.value = data
            }
          },
        )
      }
    })
    // #endregion

    // #region 更改 task
    pluginCtx.task = (ctx) => {
      const key = getKey(options, ctx.payload)
      if (!key) {
        return rawTask(ctx)
      }

      // 获取缓存信息，没有时初始化
      let cache = cacheMap.get(key)
      if (!cache) {
        cache = initCache()
        cacheMap.set(key, cache)
      }
      else if (!isValid(cache, cacheTime)) {
        expireCache(cache)
      }

      // 注册缓存上下文
      cache.contexts = otherContexts(cache).concat({ shell, options })

      // 获取缓存数据
      // 1. 存在有效缓存
      // 2. 存在未完成的执行
      if (cache.lastUpdateTime !== EXPIRED_FLAG && cache.promise) {
        return cache.promise
      }

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
        cache.contexts = otherContexts(cache)
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
    swr?: SWRPluginOptions & {
      /**
       * 请求标识，相同标识的请求将会进行数据缓存和共享，若需根据参数匹配，则应在相同参数时返回同一标识
       */
      key?: MaybeFn<string, InferTaskPayload<T>>
    }
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
