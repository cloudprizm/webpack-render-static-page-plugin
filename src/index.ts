import { compilation as compilationNS, Plugin, Stats, Compiler, Entry } from 'webpack'
import is from '@sindresorhus/is'
import { last, pick } from 'ramda'
import { runInNewContext } from 'vm'

const persistedStatsKeys = [
  'errors',
  'warnings',
  'version',
  'hash',
  'publicPath',
  'outputPath',
  'assetsByChunkName',
  'entrypoints',
]

type Env = NodeJS.ProcessEnv
export type EntryType = Entry
export type EnvVars = Env
export type EntryRef = string

export interface StaticRenderProps<K> {
  webpackStats: PersistedStats
  data?: K
}

export type StaticComponentRenderer<K> = (data: StaticRenderProps<K>) => Promise<string>

export type Compilation = compilationNS.Compilation
export type JSONWebpackStats = Stats.ToJsonOptionsObject
export type PersistedStats = Pick<
  JSONWebpackStats & { assetsByChunkName: { [key in string]: string }, outputPath: string },
  | 'errors'
  | 'warnings'
  | 'version'
  | 'hash'
  | 'publicPath'
  | 'assetsByChunkName'
  | 'entrypoints'
  | 'outputPath'
>

export const mkTinyPersistedStats = (stats: Stats): PersistedStats =>
  pick(persistedStatsKeys, stats.toJson('normal')) as PersistedStats

export interface ComponentRenderPluginOptions<K> {
  entry: EntryRef
  data?: K
  filename: string
  component: string
}

export class ComponentRenderPlugin<K> implements ComponentRenderPluginOptions<K>, Plugin {
  public data?: K
  public entry: EntryRef
  public filename: string
  public component: string

  constructor(options: ComponentRenderPluginOptions<K>) {
    this.entry = options.entry
    this.data = options.data
    this.filename = options.filename || 'index.static.html'
    this.component = options.component || 'default'
  }

  public resolveEntry(entries: Entry, entry: EntryRef): string {
    const entryPath = entries[entry]
    if (is.array(entryPath)) return last(entryPath) as string
    else if (is.string(entryPath)) return entryPath
    else return ''
  }

  public renderEntryComponent(compilation: Compilation, compiler: Compiler): Promise<string> {
    const entries = compiler.options.entry

    if (!this.entry)
      return Promise.reject(new Error('there is no entry'))

    if (!this.component)
      return Promise.reject(new Error(`please define component property from your entry ${this.entry}`))

    if (!is.plainObject(entries))
      return Promise.reject(new Error('handling only entries as plain object'))

    const entry = this.resolveEntry(entries as Entry, this.entry)
    if (!entry) return Promise.reject(new Error(`cannot find specified entry point to load, ${entry}`))

    const webpackStats = compilation.getStats()
    const tinyStats = mkTinyPersistedStats(webpackStats)
    const staticEntryName = tinyStats.assetsByChunkName[this.entry]
    const staticEntry = webpackStats.compilation.assets[staticEntryName]

    delete tinyStats.assetsByChunkName[this.entry]

    if (!staticEntry) return Promise.resolve('')

    const evaluatedSource = {
      [this.component]: null,
      Object,
      ...global, // check if necessary
    }
    runInNewContext(staticEntry.source(), evaluatedSource)

    const makeComponent = (evaluatedSource[this.component] as unknown) as StaticComponentRenderer<K>
    if (!makeComponent) return Promise.reject(new Error('there is no component to render'))
    return makeComponent({ webpackStats: tinyStats, data: this.data })
  }

  public apply(compiler: Compiler) {
    compiler.hooks.afterCompile.tapPromise('webpack-render-static-page', (compilation) =>
      this.renderEntryComponent(compilation, compiler)
        .then((html: string) => {
          if (!html)
            throw new Error(`Output from ssr is empty, for ${this.component}, ${this.entry}`)

          const file = {
            name: this.filename,
            source: html,
            size: html.length,
          }

          compilation.assets[file.name] = {
            source: () => html,
            size: () => file.size,
          }
        })
        .catch((e: Error) => compilation.warnings.push(e))
    )
  }
}

export default ComponentRenderPlugin
