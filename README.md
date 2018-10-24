# `@hungry/webpack-render-static-page-plugin`
Plugin for webpack `v4` that enables `react` to generate HTML files to serve your bundles.

## Install
```sh
yarn add @hungry/webpack-render-static-page-plugin
```

### How
#### `webpack` configuration

```js
const config = {
  entry: {
    ...,
    static: 'static.ts'               // see below on example definition
  },
  plugins: [
    renderStaticComponent({
      entry: 'static',                // defined in entries map as static
      component: 'makeIndex',         // method to be called from static entry point
      filename: 'index.static.html',  // filename for index file to be generated
      data: {}                        // some external data, i.e. env vars
    })
  ]
}
```

#### Example definition of `static` page
* static page has to fulfill `StaticComponentRenderer` interface defined as follows

```ts
interface StaticRenderProps {
  webpackStats: PersistedStats
  env: NodeJS.ProcessEnv
}
```

```js
import * as React from 'react'
import Helmet, { HelmetProvider } from 'react-helmet-async'
import { renderToString } from 'react-dom/server'
import { StaticComponentRenderer, StaticRenderProps } from '@hungry/webpack-render-static-page-plugin'

export const renderHTML = ({html, env, helmet}) =>
  `<!DOCTYPE html>
   <html ${helmet.htmlAttributes.toString()}>
     <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charset="utf-8" />
      <script>{withServiceWorkerInit}</script>
       ${helmet.noscript.toString()}
       ${helmet.title.toString()}
       ${helmet.meta.toString()}
       ${helmet.link.toString()}
       <script>window.environment = ${JSON.stringify(env)}</script>
     </head>
     <body>
        <body ${helmet.bodyAttributes.toString()}>
         <div id="app">${html}</div>
        </body>
        ${helmet.script.toString()}
     </body>
   </html>
  `

export const SomeNestedPage: React.SFC<StaticRenderProps> = props =>
  <Helmet>
    <title>Hello World</title>
    {cdnLibs.concat(lazyJSLibs).map(makeScriptTag)}
    {css.map(makeCSSTag)}
    <body className="root" />
  </Helmet>

export const makeIndex: StaticComponentRenderer =
  (compilationData) => {
    const context = { ...helmetContext }
    const App = <HelmetProvider context={context}>
      <SomeNestedPage
        webpackStats={compilationData.webpackStats}
        env={compilationData.env}
      />
    </HelmetProvider>

    return Promise.resolve(
      renderHTML(appString, {
        html: renderToString(App),
        helmet: context.helmet,
        env: compilationData.env,
      })
    )
  }
```

### Why
To be able to generate `index` page based on `helmet` or `helmet-async` rather than playing with `handlebars` or `velocity` templates. Another goal was to not making `webpack` config too verbose and make `index` page testable.

#### Caveats
This is at stage `works for me`, so if you've got any troubles, please let me know.