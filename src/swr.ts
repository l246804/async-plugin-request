import type {
  InferTaskPayload,
  InferTaskReturn,
  UseAsyncOptions,
  UseAsyncPlugin,
  UseAsyncReturn,
} from '@magic-js/use-async'
import type { MaybeFn } from '@rhao/types-base'
import { tryOnScopeDispose } from '@vueuse/core'
import { baseAssign, promiseWithControl, toValue } from 'nice-fns'

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
  lastUpdateTime: number | typeof INVALID_TIME
  /**
   * 缓存的原始数据
   */
  rawData: any
  /**
   * `promiseWithControl()`
   */
  promiseCtrl?: ReturnType<typeof promiseWithControl>
  /**
   * `useAsync()` 配置项和返回结果集合
   */
  contexts: { shell: UseAsyncReturn, options: UseAsyncOptions }[]
}

const CANCEL_FLAG = Symbol('cancel flag')
const INVALID_TIME = Symbol('invalid time')

function isValid(cache: CacheModel | undefined, cacheTime: number) {
  return (
    cacheTime > 0
    && !!cache
    && cache.lastUpdateTime !== INVALID_TIME
    && Date.now() - cache.lastUpdateTime < cacheTime
  )
}

function getKey(options: UseAsyncOptions, payload: any[]) {
  return options.swr?.key ? toValue(options.swr.key, payload) : null
}

/**
 * 创建 SWRPlugin
 * @description SWR(stale-while-revalidate)
 */
export function createSWRPlugin(pluginOptions: SWRPluginOptions = {}): UseAsyncPlugin {
  const { cacheTime: baseCacheTime = 0 } = pluginOptions

  const cacheMap = new Map<string, CacheModel>()
  return function SWRPlugin(pluginCtx) {
    const { options, shell, hooks } = pluginCtx

    type Predicate = (item: { shell: UseAsyncReturn, options: UseAsyncOptions }) => boolean
    function otherContexts(cache: CacheModel, predicate: Predicate = () => true) {
      return cache.contexts.filter(
        (item) => item.shell !== shell && item.options !== options && predicate(item),
      )
    }

    // #region 注册 revalidate()
    shell.revalidate = (...args: any[]) => {
      const hasArgs = args.length > 0
      const payload = hasArgs ? args : shell.payload.value
      const key = getKey(options, payload)
      if (key) {
        const cache = cacheMap.get(key)
        if (cache) {
          cache.lastUpdateTime = INVALID_TIME
        }
      }
      return shell.execute(...payload)
    }
    // #endregion

    const { cacheTime = baseCacheTime } = options.swr || {}

    // #region 注册 success 事件
    hooks.hook('success', ({ payload, rawData }) => {
      const key = getKey(options, payload)
      if (!key)
        return

      const cache = cacheMap.get(key)
      if (cache) {
        baseAssign(cache, {
          lastUpdateTime: Date.now(),
          rawData,
        } as CacheModel)

        cache.promiseCtrl?.resolve(rawData)
      }
    })
    // #endregion

    // #region 注册 error 事件
    hooks.hook('error', ({ payload, rawData }) => {
      const key = getKey(options, payload)
      if (!key)
        return

      const cache = cacheMap.get(key)
      if (cache) {
        baseAssign(cache, {
          lastUpdateTime: INVALID_TIME,
          rawData,
        } as CacheModel)

        cache.promiseCtrl?.reject(rawData)
      }
    })
    // #endregion

    // #region 注册 after 事件
    hooks.hook('after', ({ payload, rawData, data, isCanceled }) => {
      const key = getKey(options, payload)
      if (!key)
        return

      const cache = cacheMap.get(key)
      if (cache && cache.promiseCtrl) {
        if (isCanceled()) {
          cache.promiseCtrl.resolve(CANCEL_FLAG)
        }
        else {
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
        cache.promiseCtrl = undefined
      }
    })
    // #endregion

    // #region 注册 before 事件
    hooks.hook('before', (ctx) => {
      const key = getKey(options, ctx.payload)
      if (!key) {
        return
      }

      // 获取缓存信息，没有时初始化
      let cache = cacheMap.get(key)
      if (!cache) {
        cache = {
          lastUpdateTime: INVALID_TIME,
          rawData: shell.rawData.value,
          contexts: [],
        }
        cacheMap.set(key, cache)
      }
      else if (!isValid(cache, cacheTime)) {
        cache.lastUpdateTime = INVALID_TIME
      }

      cache.contexts = otherContexts(cache).concat({ shell, options })

      // 更改执行任务，获取缓存数据
      // 1. 存在有效缓存
      // 2. 存在未完成的执行
      if (cache.lastUpdateTime !== INVALID_TIME || cache.promiseCtrl) {
        const rawTask = pluginCtx.task
        pluginCtx.task = () => {
          const promise = cache.promiseCtrl?.promise || Promise.resolve()
          // 若前执行被取消则正常执行原始任务
          return promise.then((val) => val === CANCEL_FLAG ? rawTask() : cache.rawData)
        }
        return
      }

      // 设置当前执行的 promiseCtrl
      cache.promiseCtrl = promiseWithControl()
    })

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
     * 标记已存在数据为失效状态并重新执行任务获取有效数据
     * - `revalidate()`: 标记数据失效并执行 `reExecute()`
     * - `revalidate(...payload)`: 标记数据失效并执行 `execute(...payload)`
     */
    revalidate: {
      (): Promise<InferTaskReturn<T> | undefined>
      (...payload: InferTaskPayload<T>): Promise<InferTaskReturn<T> | undefined>
    }
  }
}
