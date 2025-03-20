export type MaybeFn<T, Args extends any[] = []> = T | ((...args: Args) => T)

export type Awaitable<T> = T | Promise<T>

export type Fn<Args extends any[], R> = (...args: Args) => R
