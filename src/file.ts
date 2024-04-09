import fs from 'fs-extra'
import path from 'path'

/**`
 * 尝试读取具有不同可能后缀的文件。
 *
 * @param baseFilePath 基础文件路径，不包含后缀。
 * @param extensions 尝试的文件后缀数组。
 * @returns 异步返回读取到的文件内容。
 */
export function readFileWithExtensions(
  baseFilePath: string,
  extensions: string[] = ['.js', '.jsx', '.ts', '.tsx', '.json', 'txt'],
): string {
  for (const ext of extensions) {
    const filePath = baseFilePath.includes(ext)
      ? baseFilePath
      : `${baseFilePath}${ext}`
    try {
      return fs.readFileSync(filePath, 'utf8')
    } catch (error: any) {
      // 如果文件不存在，则继续尝试下一个后缀
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }
  throw new Error(`No file found with the given extensions.(${baseFilePath})`)
}

/**
 * 确认指定路径下是否存在具有不同可能文件后缀的目标文件。
 *
 * @param baseFilePath 基础文件路径，不包含后缀。
 * @param extensions 尝试的文件后缀数组。
 * @returns 异步返回一个布尔值，表示目标文件是否存在。
 */
export async function existFileWithExtensions(
  baseFilePath: string,
  extensions: string[] = ['.js', '.jsx', '.ts', '.tsx', '.json', 'txt'],
): Promise<string> {
  for (const ext of extensions) {
    const filePath = baseFilePath.includes(ext)
      ? baseFilePath
      : `${baseFilePath}${ext}`
    try {
      await fs.access(filePath)
      return filePath
    } catch (error: any) {
      // 如果文件不存在，则继续尝试下一个后缀
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }
  return ''
}

/**
 * 读取基于相对路径的 import 文件内容。
 *
 * @param sourceFilePath 源文件路径。
 * @param importPath 源文件内的 import 路径。
 * @returns 异步返回读取到的文件内容。
 */
export async function readRelativeImportFile(
  sourceFilePath: string,
  importPath: string,
): Promise<string> {
  // 确保 import 路径是相对路径
  if (!isRelative(importPath)) {
    throw new Error('Import path is not a relative path.')
  }

  // 计算 import 文件的基本路径（不包含后缀）
  const baseImportFilePath = path.resolve(
    path.dirname(sourceFilePath),
    importPath,
  )

  // 尝试的文件后缀列表
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json']

  // 尝试读取文件
  return readFileWithExtensions(baseImportFilePath, extensions)
}

/**
 * 读取指定文件夹下的所有文件的文件名。
 *
 * @param folderPath 文件夹路径。
 * @returns 异步返回包含所有文件名的数组。
 */
export async function readAllFileNames(folderPath: string): Promise<string[]> {
  const fileNames: string[] = []

  try {
    const files = await fs.readdir(folderPath)

    for (const file of files) {
      const filePath = path.join(folderPath, file)
      const stats = await fs.stat(filePath)

      if (stats.isFile()) {
        fileNames.push(file)
      }
    }
  } catch (error: any) {
    throw new Error(`Failed to read folder: ${folderPath}`)
  }

  return fileNames
}

/** 获得真实引用文件路径 */
export async function getRealImportFilePath(
  /** 项目根路径 */
  rootDir: string,
  /** 配置文件绝对路径 */
  fileDir: string,
  /** 引用路径 */
  importPath: string,
  /** 引用别名 */
  importAlias?: Record<string, string>,
) {
  let realPath = ''

  if (fileDir.includes('config/config') && !importPath.startsWith('@')) {
    // kmi router 特殊配置，默认走src/pages下
    realPath = path.resolve(rootDir, 'src/pages', importPath)
  } else if (isRelative(importPath)) {
    // 相对于配置文件
    realPath = path.resolve(fileDir, '..', importPath)
  } else {
    // 兜底src下
    realPath = importPath.startsWith('src')
      ? path.resolve(rootDir, importPath)
      : path.resolve(rootDir, 'src', importPath)

    const enableAlias = {
      '@/': 'src/',
      ...(importAlias || {}),
    }
    Object.entries(enableAlias).forEach(([alias, target]) => {
      if (importPath.startsWith(alias)) {
        realPath = path.resolve(rootDir, importPath.replace(alias, target))
      }
    })
  }

  // 目录特殊处理
  if (isDirectory(realPath)) {
    realPath = path.resolve(realPath, 'index')
  }

  // 确定入口文件
  return existFileWithExtensions(path.resolve(realPath))
}

export function isDirectory(p: string) {
  try {
    return fs.lstatSync(p).isDirectory()
  } catch (error) {
    return false
  }
}

export function isRelative(p: string) {
  return p.startsWith('.') || p.startsWith('..')
}

/**
 * 根据路由文件位置，获取应用根路径
 * 逐级往上寻找有pkg.json的目录，即视为根路径
 */
export function getAppRootDir(routeConfigPath: string) {
  // 同目录是否有pkg.json
  const parentPath = path.resolve(routeConfigPath, '..')
  const files = fs.readdirSync(parentPath)
  for (const file of files) {
    if (file === 'package.json') {
      return parentPath
    }
  }
  return getAppRootDir(parentPath)
}
