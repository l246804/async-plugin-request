import type { ExecuteContext, Task, UseAsyncPlugin } from '@magic-js/use-async'
import type { Awaitable } from '@rhao/types-base'
import { isFunction } from 'nice-fns'

type CustomUnwrap<T extends Task = Task> = (
  ctx: ExecuteContext.Success<T>,
) => Awaitable<unknown> | void

export interface UnwrapDataPluginOptions {
  /**
   * 数据拆解函数，支持异步拆解，失败时可直接抛出异常，将会进入到 `error()` 事件
   * - PropertyKey: 根据 `ctx.rawData` 获取指定 `Getter`
   * - Function: 自定义拆解函数，内部需自行设置 `ctx.data`
   */
  unwrap?: PropertyKey | CustomUnwrap
}

async function defaultUnwrap(ctx: ExecuteContext.Success, key?: PropertyKey) {
  const unwrap = key == null ? null : ctx.rawData?.[key]
  if (isFunction(unwrap)) {
    ctx.data = await unwrap()
  }
}

/**
 * 创建 UnwrapDataPlugin
 * @description 数据拆解插件
 *
 * ***注意：推荐将该插件注册在首位，否则可能导致其他插件未能获取到被拆解的正确数据！***
 *
 * @example
 * ```ts
 * interface BackendFormat<Data = any> {
 *   code: number
 *   data: Data
 *   message?: string
 * }
 *
 * axios.interceptors.response.use((response) => {
 *   // 定义数据拆解函数
 *   response._unwrapResponse = () => {
 *     const responseData: BackendFormat = response.data
 *     // 非 200 时直接抛出异常，useAsync 会直接进入到 `error()` 事件
 *     if (responseData.code !== 200) {
 *       throw new Error(responseData.message)
 *     }
 *     // 返回被拆解的正确数据
 *     return responseData.data
 *   }
 *
 *   // 可以在这里进行第一次拆解，让应该失败的响应直接进入到 `catch()` 中，
 *   // 同时推荐缓存拆解后的结果，避免重复拆解
 *   // response._unwrapResponse()
 *
 *   // 返回原始响应，不改变正常通过 axios 请求的返回值
 *   return response
 * })
 *
 * const api = () => axios.get<BackendFormat<number[]>>('/api/list')
 * // => () => Promise<AxiosResponse<BackendFormat<number[]>>>
 *
 * useAsync(api, {
 *   hooks: {
 *     success(e) {
 *       console.log(e.data) // => number[]
 *     },
 *     error(e) {
 *       console.log(e.error) // => AxiosResponseError
 *     }
 *   },
 *
 *   plugins: [
 *     // 注册 UnwrapDataPlugin
 *     createUnwrapDataPlugin({
 *       // 设置拆解函数标识，将会尝试读取 `ctx.rawData._unwrapResponse`，仅支持 `Getter` 函数
 *       unwrap: '_unwrapResponse',
 *
 *       // 自定义拆解函数，需自行拆解原始数据并重新赋值给 `ctx.data`
 *       unwrap(ctx) {
 *         const unwrap = ctx.rawData?._unwrapResponse
 *         if (typeof unwrap === 'function') {
 *           ctx.data = unwrap()
 *         }
 *       }
 *     })
 *   ]
 * })
 * ```
 */
export function createUnwrapDataPlugin(pluginOptions: UnwrapDataPluginOptions): UseAsyncPlugin {
  const { unwrap: baseUnwrap } = pluginOptions

  async function unwrapFn(ctx: ExecuteContext.Success) {
    const { unwrap: userUnwrap = true } = ctx.options

    // 跳过拆解操作
    if (userUnwrap === false) {
      return
    }

    const finalUnwrap = isFunction(userUnwrap)
      ? userUnwrap
      : isFunction(baseUnwrap)
        ? baseUnwrap
        : () => defaultUnwrap(ctx, baseUnwrap)

    await finalUnwrap(ctx)
  }

  return function UnwrapDataPlugin({ hooks }) {
    hooks.hook('success', unwrapFn)
  }
}

declare module '@magic-js/use-async' {
  interface UseAsyncOptions<T> {
    /**
     * 数据拆解函数，支持异步拆解，失败时可直接抛出异常，将会进入到 `error()` 事件
     * - Boolean: 根据 `UnwrapDataPluginOptions.unwrap` 配置进行拆解原始数据，设为 `false` 时跳过拆解
     * - Function: 自定义拆解函数，内部需自行设置 `ctx.data`
     * @default true
     */
    unwrap?: boolean | CustomUnwrap<T>
  }
}
