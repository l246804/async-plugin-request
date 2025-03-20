import type { Fn, MaybeFn } from './_interface'
import { isFunction } from 'es-toolkit'

export function resolveValue<T, Args extends any[]>(value: MaybeFn<T, Args>, ...args: Args): T {
  return isFunction(value) ? (value as Fn<Args, T>)(...args) : (value as T)
}
