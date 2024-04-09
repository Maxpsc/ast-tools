import { isDirectory, isRelative } from './file'
import { parse } from '@babel/parser'
import traverse, { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import fs from 'fs-extra'
import { dirname, resolve } from 'path'

const extensions = ['.js', '.jsx', '.ts', '.tsx']
interface ImportMap {
  /**
   * @description 导入的信息的唯一标识(文件绝对路径)
   */
  id: string

  /**
   * @description 导入来源的相对路径
   */
  source: string

  /**
   * @description 导出的值的类型, 值或者ts类型
   */
  importKind?: 'value' | 'type'

  /**
   * @description 在导出文件的引用名称
   */
  exportName?: string
}

interface ImportMapWithDeps extends ImportMap {
  beImportedId?: string
  dependencies?: Record<string, ImportMapWithDeps>
}

/**
 * 转化文件为AST抽象语法树
 *
 * @param filePath
 * @returns AST
 */
const transformToAST = (filePath: string) => {
  let realPath = ''

  if (isDirectory(filePath)) {
    fs.readdirSync(filePath).forEach(item => {
      if (
        !isDirectory(resolve(filePath, item)) &&
        item.includes('index') &&
        extensions.includes(item.slice(item.lastIndexOf('.')))
      ) {
        realPath = resolve(filePath, item)
      }
    })
  } else {
    const fileName = filePath.slice(filePath.lastIndexOf('/')).replace('/', '')
    // 文件名后缀: 最后一个.后的字符
    const suffix =
      fileName.lastIndexOf('.') > -1
        ? fileName.slice(fileName.lastIndexOf('.'))
        : ''

    if (suffix && extensions.includes(suffix)) {
      realPath = filePath
    } else if (!suffix) {
      const pathes = [filePath, ...extensions.map(ext => `${filePath}${ext}`)]
      realPath = pathes.find(p => fs.existsSync(p)) as string
    }
  }

  if (!realPath) return null

  try {
    const content = fs.readFileSync(realPath, 'utf-8')
    return content
      ? parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx', 'decorators'],
        })
      : null
  } catch (error) {
    console.log('[解析ast报错]', filePath, realPath, error)
    return null
  }
}

export const analyzeImports = (
  filePath: string,
  filter?: (source: string) => boolean,
) => {
  const result: { [identifier: string]: ImportMap } = {}

  const ast = transformToAST(filePath)
  ast &&
    traverse(ast, {
      ImportNamespaceSpecifier(path: NodePath<t.ImportNamespaceSpecifier>) {
        // 类似 import * as React from 'react' 中的 React
        const parentNode: any = path.parentPath.node
        const source = parentNode.source.value
        let absoluteSource
        if (isRelative(source)) {
          if (isDirectory(filePath)) {
            absoluteSource = resolve(filePath, source)
          } else {
            absoluteSource = resolve(dirname(filePath), source)
          }
        } else if (!filter || filter?.(source)) {
          absoluteSource = source
        }

        if (absoluteSource) {
          const { importKind } = parentNode
          const identifier = path.get('local').node.name
          result[identifier] = {
            id: absoluteSource,
            source,
            importKind,
          }
        }
      },
      ImportDefaultSpecifier(path: NodePath<t.ImportDefaultSpecifier>) {
        // 类似 import SelectWithBackFill from '../SelectWithBackFill' 中的 SelectWithBackFill
        const parentNode: any = path.parentPath.node
        const source = parentNode.source.value
        let absoluteSource
        if (isRelative(source)) {
          if (isDirectory(filePath)) {
            absoluteSource = resolve(filePath, source)
          } else {
            absoluteSource = resolve(dirname(filePath), source)
          }
        } else if (!filter || filter?.(source)) {
          absoluteSource = source
        }

        if (absoluteSource) {
          const { importKind } = parentNode
          const identifier = path.get('local').node.name
          result[identifier] = {
            id: absoluteSource,
            source,
            importKind,
            exportName: 'default',
          }
        }
      },
      ImportSpecifier(path: NodePath<t.ImportSpecifier>) {
        // 类似 import SelectMultiTree, { Option, RenderKey } from '../SelectMultiTree' 中的 Option, RenderKey
        const parentNode: any = path.parentPath.node
        const source = parentNode.source.value
        let absoluteSource
        if (isRelative(source)) {
          if (isDirectory(filePath)) {
            absoluteSource = resolve(filePath, source)
          } else {
            absoluteSource = resolve(dirname(filePath), source)
          }
        } else if (!filter || filter?.(source)) {
          absoluteSource = source
        }
        if (absoluteSource) {
          const { importKind } = parentNode
          const identifier = path.get('local').node.name
          const exportName = (path.get('imported').node as any).name
          result[identifier] = {
            id: absoluteSource,
            source,
            importKind,
            exportName,
          }
        }
      },
    })

  return result
}

export const analyzeDependencies = (
  filePath: string,
  filter?: (source: string) => boolean,
) => {
  try {
    const dependencies = analyzeImports(filePath, filter)

    const deepCollect = (
      last: ImportMapWithDeps['dependencies'],
      parentIds: string[],
    ) => {
      if (last && Object.keys(last).length) {
        Object.keys(last).forEach(key => {
          const dep = last[key]

          if (isRelative(dep.source) && !dep.id.endsWith('.json')) {
            // last[key].dependencies = analyzeImports(dep.id, filter)
            // deepCollect(last[key].dependencies, dep.id)

            const innerDeps = analyzeImports(dep.id, filter)
            // 避免循环引用
            if (!Object.values(innerDeps).find(i => parentIds.includes(i.id))) {
              last[key].dependencies = innerDeps
              deepCollect(last[key].dependencies, parentIds.concat(dep.id))
            }
          }
        })
      }
    }
    deepCollect(dependencies, [filePath])

    return dependencies
  } catch (err) {
    console.log('[分享依赖关系报错]', err)
    return {}
  }
}
