# Changelog

## <small>2.0.2 (2025-03-28)</small>

- fix(axios): 修复 axios 插件合并配置项丢失属性 ([6081c9a](https://github.com/l246804/async-plugin-request/commit/6081c9a))

## <small>2.0.1 (2025-03-21)</small>

- build: 更新构建工具并调整依赖项 ([ebbedba](https://github.com/l246804/async-plugin-request/commit/ebbedba))

## 2.0.0 (2025-03-20)

- build: 重构构建配置并添加代码风格配置 ([605261a](https://github.com/l246804/async-plugin-request/commit/605261a))
- refactor(src): 重构代码并优化功能 ([616caeb](https://github.com/l246804/async-plugin-request/commit/616caeb))

## 1.0.0 (2025-03-19)

- chore: 升级依赖并格式化代码 ([f636dbb](https://github.com/l246804/async-plugin-request/commit/f636dbb))
- refactor(axios): 优化 Axios 插件实现 ([33cf983](https://github.com/l246804/async-plugin-request/commit/33cf983))

## [0.4.1](https://github.com/l246804/async-plugin-request/compare/v0.4.0...v0.4.1) (2025-02-13)

### Chores

- 🤖 axios 导出 patchAxios 函数 ([ddc675a](https://github.com/l246804/async-plugin-request/commit/ddc675ab568199d13598dce63357f026a6201600))

## [0.4.0](https://github.com/l246804/async-plugin-request/compare/v0.3.3...v0.4.0) (2024-12-11)

### Features

- 🎸 SWR 支持零引用时保留缓存数据 ([0991416](https://github.com/l246804/async-plugin-request/commit/0991416fc3395f30951606e6954a00968cdf223a))

### Chores

- 🤖 补充插件注释说明 ([f182007](https://github.com/l246804/async-plugin-request/commit/f182007319b3f104d1cae07aaf0129c39bdba157))

## [0.3.3](https://github.com/l246804/async-plugin-request/compare/v0.3.2...v0.3.3) (2024-11-01)

### Chores

- 🤖 replace @vue/reactivity to vue ([d3cbb40](https://github.com/l246804/async-plugin-request/commit/d3cbb402bd445e3c473f7012d6987b0f16e6ffa8))
- 🤖 replace onScopeDispose to tryOnScopeDispose ([7eb0475](https://github.com/l246804/async-plugin-request/commit/7eb04756749955614e6c6939999589a591dd0a8d))

## [0.3.2](https://github.com/l246804/async-plugin-request/compare/v0.3.1...v0.3.2) (2024-10-30)

### Bug Fixes

- 🐛 修复 RefreshToken silent 功能无效 ([5e3469d](https://github.com/l246804/async-plugin-request/commit/5e3469d44d737d2cb54d07d6c95933b5ca1c5ebb))

## [0.3.1](https://github.com/l246804/async-plugin-request/compare/v0.3.0...v0.3.1) (2024-10-30)

### Bug Fixes

- 🐛 修复 RefreshToken 可能导致返回结果为 false ([6d69f86](https://github.com/l246804/async-plugin-request/commit/6d69f8639113c36a8994cb9a8cfd834207502a1c))

## [0.3.0](https://github.com/l246804/async-plugin-request/compare/v0.2.3...v0.3.0) (2024-10-25)

### Features

- 🎸 add UnwrapDataPlugin ([0280d4b](https://github.com/l246804/async-plugin-request/commit/0280d4bd8421b4d0e4524a2620ee838fe19e6e2a))

### Chores

- 🤖 LoadingDelay 插件在 onScopeDispose 时释放监听器 ([02d651d](https://github.com/l246804/async-plugin-request/commit/02d651da99e7a432efa2a1e7d67f7208125d0ce7))

## [0.2.3](https://github.com/l246804/async-plugin-request/compare/v0.2.2...v0.2.3) (2024-10-16)

### Bug Fixes

- 🐛 修复 refresh-token 未捕获原始任务执行异常 ([37ade08](https://github.com/l246804/async-plugin-request/commit/37ade08fa00613b9f7ccb24e16d09fcee940c300))

## [0.2.2](https://github.com/l246804/async-plugin-request/compare/v0.2.1...v0.2.2) (2024-10-12)

### Bug Fixes

- 🐛 修复 axios 插件合并配置项后存在属性丢失 ([39123e6](https://github.com/l246804/async-plugin-request/commit/39123e6fc0e1ee6ab8c3d5c4ae482243dea22c1a))

## [0.2.1](https://github.com/l246804/async-plugin-request/compare/v0.2.0...v0.2.1) (2024-10-12)

### Bug Fixes

- 🐛 修复 axios 插件更改原型函数报错 ([516c96b](https://github.com/l246804/async-plugin-request/commit/516c96bc586ffb3c0660b0b9927488b73dbcf36b))

## [0.2.0](https://github.com/l246804/async-plugin-request/compare/v0.2.0-5...v0.2.0) (2024-10-10)

## [0.2.0-5](https://github.com/l246804/async-plugin-request/compare/v0.2.0-4...v0.2.0-5) (2024-10-10)

### Bug Fixes

- 🐛 修复 swr.triggerData ([3ea82c7](https://github.com/l246804/async-plugin-request/commit/3ea82c7de695ff6deadd966472f18a2e30e407ed))

## [0.2.0-4](https://github.com/l246804/async-plugin-request/compare/v0.2.0-3...v0.2.0-4) (2024-10-10)

### Chores

- 🤖 swr.triggerData 支持仅执行 triggerRef ([f1df124](https://github.com/l246804/async-plugin-request/commit/f1df124738a108e371597dad766d783e78433492))

## [0.2.0-3](https://github.com/l246804/async-plugin-request/compare/v0.2.0-2...v0.2.0-3) (2024-10-10)

### Features

- 🎸 swr 新增 triggerData 用于触发其他相同键的响应式数据更新 ([8738129](https://github.com/l246804/async-plugin-request/commit/87381299c6d672db8beb3fedadc78a27fc2ec9f1))

### Chores

- 🤖 移除 createSWRPlugin 的配置 ([8448cf8](https://github.com/l246804/async-plugin-request/commit/8448cf852e72a3f91ff9bd85866b65a5830eb76d))

## [0.2.0-2](https://github.com/l246804/async-plugin-request/compare/v0.2.0-1...v0.2.0-2) (2024-10-10)

### Bug Fixes

- 🐛 修复 swr 在重复执行同一任务时未共享 promise ([db65da5](https://github.com/l246804/async-plugin-request/commit/db65da5057e5a3fd611b87aa19552fcaeccff73d))

## [0.2.0-1](https://github.com/l246804/async-plugin-request/compare/v0.2.0-0...v0.2.0-1) (2024-10-10)

### Chores

- 🤖 优化 SWR 缓存共享功能 ([ca53c49](https://github.com/l246804/async-plugin-request/commit/ca53c4959e1e3e32a2e7bf9f2efc92f9c822b63c))
- 🤖 update deps ([2a2e7ca](https://github.com/l246804/async-plugin-request/commit/2a2e7ca1b0630aabe75aadd838d7dfc3d2093639))

## [0.2.0-0](https://github.com/l246804/async-plugin-request/compare/v0.1.0...v0.2.0-0) (2024-10-09)

### Features

- 🎸 开发 swr 插件 ([362a337](https://github.com/l246804/async-plugin-request/commit/362a3374ee25ceabedd11ad1bb0beca6c1dcb3cb))

### Chores

- 🤖 补充 README.md ([cfc8aab](https://github.com/l246804/async-plugin-request/commit/cfc8aabe50ec44f44154794661ae33f3a0bde6c1))
- 🤖 update settings.json ([6c7fb00](https://github.com/l246804/async-plugin-request/commit/6c7fb00a3dc855f3559c29a9afe909731475403c))

## 0.1.0 (2024-09-26)

### Features

- 🎸 init repo ([2a24ef1](https://github.com/l246804/async-plugin-request/commit/2a24ef18a79febc9a06c107cb0fdfc5032e085cc))
