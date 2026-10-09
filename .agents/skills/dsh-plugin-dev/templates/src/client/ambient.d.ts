/**
 * 最小环境类型桩（零依赖自包含，只声明实际用到的成员）：
 * - react / react/jsx-runtime：浏览器运行时由 dsh web shell 提供，这里只做类型声明
 * - @deepseek-ai/dsh-client-ui-primitives：内置于 web shell 的 staticModules，
 *   磁盘上不存在（profile node_modules 中无此包），运行时由浏览器模块加载器提供
 * - 给真模块补声明（模块增强）必须写在本文件这类「模块」里；
 *   给 node 内置模块写桩则放无 import/export 的全局 .d.ts（坑 14）
 */

declare module 'react' {
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void]
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useRef<T>(initial: T): { current: T }
  export function useRef<T>(initial: T | null): { current: T | null }
  export function useSyncExternalStore<Snap>(
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => Snap,
  ): Snap
}

declare module 'react/jsx-runtime' {
  export const jsx: unknown
  export const jsxs: unknown
  export const Fragment: unknown
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export const Menu: any
  /** 0.2.0 图标命名：名称 + Outline + Regular/Medium（旧的 *Outline14/16 不存在——坑 18） */
  export const IconChevronDownOutlineRegular: any
}

declare namespace JSX {
  interface IntrinsicElements {
    div: Record<string, unknown> & { children?: unknown }
    span: Record<string, unknown> & { children?: unknown }
    li: Record<string, unknown> & { children?: unknown }
    p: Record<string, unknown> & { children?: unknown }
    button: Record<string, unknown> & { children?: unknown }
    input: Record<string, unknown> & { children?: unknown }
    textarea: Record<string, unknown> & { children?: unknown }
    label: Record<string, unknown> & { children?: unknown }
  }
}
