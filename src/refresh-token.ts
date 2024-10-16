import type {
  ExecuteContext,
  Task,
  UseAsyncError,
  UseAsyncPlugin,
  UseAsyncPluginContext,
} from '@magic-js/use-async'
import type { Awaitable } from '@rhao/types-base'
import { createError } from '@magic-js/use-async'
import { toValue } from 'nice-fns'

export interface RefreshTokenContext<T extends Task = Task>
  extends UseAsyncPluginContext<T>,
  Pick<ExecuteContext.Before<T>, 'isAborted'> {
  /**
   * 刷新令牌失败后终止再次执行原始任务并将抛出原始错误
   */
  abort: () => void
}

export interface RefreshTokenPluginOptions {
  /**
   * 是否启用刷新令牌功能
   * - boolean: `false` 时关闭
   * - function: 返回假值时关闭
   * @default true
   */
  enabled?: boolean | ((ctx: Readonly<RefreshTokenContext>) => Awaitable<unknown> | void)
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
      if (!toValue(enabled, refreshTokenCtx))
        return rawTask(ctx)

      // 正在刷新时等待刷新成功后执行原始任务
      if (refreshPromise) {
        return refreshPromise.then(() => rawTask(ctx))
      }

      try {
        return await rawTask(ctx)
      }
      catch (e: unknown) {
        const error = createError(e)

        // 验证过期后开始刷新令牌，否则抛出错误
        if (await assertExpired(error)) {
          if (!refreshPromise) {
            refreshPromise = new Promise((resolve) => {
              resolve(handler({ ...refreshTokenCtx, abort: () => ctx.abort(error) }))
            })
          }

          return refreshPromise
            .then(() => !refreshTokenCtx.isAborted() && rawTask(ctx))
            .catch(() => Promise.reject(error))
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
