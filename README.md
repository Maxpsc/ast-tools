# ast-tools
AST分析常用工具函数集。

## Utils

```ts
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
```


### analyzeImports
解析文件所有import，返回一个组装后的map。

```ts
interface AnalyzeImports {
  (filePath: string, filter?: (source: string) => boolean): {
    [identifier: string]: ImportMap
  }
}

const imports = analyzeImports(absoluteFilePath)

```

### analyzeDependencies
根据入口文件，返回所有相关依赖（递归）

```ts
interface ImportMapWithDeps extends ImportMap {
  beImportedId?: string
  dependencies?: Record<string, ImportMapWithDeps>
}

interface AnalyzeDependencies {
  (filePath: string, filter?: (source: string) => boolean): {
    [identifier: string]: ImportMapWithDeps
  }
}

const deps = analyzeDependencies(absoluteFilePath)
```
