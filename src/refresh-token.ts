import type {
  ExecuteContext,
  Task,
  UseAsyncError,
  UseAsyncPlugin,
  UseAsyncPluginContext,
} from '@magic-js/use-async'
import type { Awaitable } from './_interface'
import { createError } from '@magic-js/use-async'
import { resolveValue } from './_utils'

export interface RefreshTokenContext<T extends Task = Task>
  extends UseAsyncPluginContext<T>,
  Pick<ExecuteContext.Before<T>, 'isAborted'> {
  /**
   * 刷新令牌失败后终止再次执行原始任务
   * @param silent 设为 `true` 时将尝试返回 `options.initialData` 并进入到 `hooks.success` 事件，否则抛出原始错误，将会进入到 `hooks.error` 事件
   */
  abort: (silent?: boolean) => void
}

export interface RefreshTokenPluginOptions {
  /**
   * 是否启用刷新令牌功能
   * - boolean: `false` 时关闭
   * - function: 返回假值时关闭
   * @default true
   */
  enabled?: boolean | ((ctx: Readonly<RefreshTokenContext>) => Awaitable<void | unknown>)
  /**
   * 验证令牌是否过期
   */
  assertExpired: (error: UseAsyncError) => Awaitable<unknown> | void
  /**
   * 允许刷新令牌时的具体刷新操作
   */
  handler: (ctx: Readonly<RefreshTokenContext>) => Awaitable<unknown> | void
}

/**
 * 创建 RefreshTokenPlugin
 * @description 动态刷新请求访问令牌
 */
export function createRefreshTokenPlugin(pluginOptions: RefreshTokenPluginOptions): UseAsyncPlugin {
  const { enabled: baseEnabled = true, assertExpired, handler } = pluginOptions

  let refreshPromise: Promise<any> | null = null
  return function RefreshTokenPlugin(pluginCtx) {
    const { task: rawTask } = pluginCtx
    pluginCtx.task = async (ctx) => {
      // 获取配置项
      const { enabled = baseEnabled } = ctx.options.refreshToken || {}
      const refreshTokenCtx: RefreshTokenContext = {
        ...pluginCtx,
        abort: () => ctx.abort(),
        isAborted: ctx.isAborted,
      }

      // 禁用时直接返回原始任务
      if (!resolveValue(enabled, refreshTokenCtx))
        return rawTask(ctx)

      // 正在刷新时等待刷新成功后执行原始任务
      if (refreshPromise) {
        return refreshPromise.then(() => rawTask(ctx))
      }

      try {
        // 需等待原始任务的执行
        return await rawTask(ctx)
      }
      catch (e: unknown) {
        const error = createError(e)
        let shouldThrowError = true

        // 验证过期后开始刷新令牌，否则抛出错误
        if (await assertExpired(error)) {
          if (!refreshPromise) {
            refreshPromise = new Promise((resolve) => {
              resolve(
                handler({
                  ...refreshTokenCtx,
                  abort: (silent) => {
                    shouldThrowError = !silent
                    return ctx.abort(error)
                  },
                }),
              )
            })
          }

          const promiseHandler = (resumeTask: boolean) => {
            if (refreshTokenCtx.isAborted()) {
              if (shouldThrowError) {
                return Promise.reject(error)
              }
              else {
                return resolveValue(ctx.options.initialData)
              }
            }

            return resumeTask ? rawTask(ctx) : Promise.reject(error)
          }

          return refreshPromise
            .then(() => promiseHandler(true))
            .catch(() => promiseHandler(false))
            .finally(() => {
              refreshPromise = null
            })
        }

        throw error
      }
    }
  }
}

declare module '@magic-js/use-async' {
  interface UseAsyncOptions<T> {
    refreshToken?: {
      /**
       * 是否启用刷新令牌功能
       * - boolean: `false` 时关闭
       * - function: 返回假值时关闭
       * @default RefreshTokenPluginOptions.enabled
       */
      enabled?: boolean | ((ctx: Readonly<RefreshTokenContext<T>>) => Awaitable<unknown> | void)
    }
  }
}
