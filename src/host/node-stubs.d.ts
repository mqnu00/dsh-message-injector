/**
 * node 内置模块最小类型桩（本项目零外部类型依赖，只声明实际用到的成员）。
 *
 * 注意：本文件是全局脚本（无 import/export），`declare module` 在此为环境模块声明；
 * 需要模块增强（declare module 真模块）请写在 ambient.d.ts（模块文件）里。
 */

declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>
}

declare module 'node:path' {
  export function join(...parts: string[]): string
}
