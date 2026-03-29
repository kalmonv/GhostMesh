import { readFile, writeFile } from 'node:fs/promises'

const files = [
  'dist/ghostmesh.iife.js',
  'dist/ghostmesh.umd.cjs'
]

const footer = `
;(function () {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
        ? self
        : null

  if (!root || !root.GhostMesh || !root.GhostMesh.default) {
    return
  }

  const namespace = root.GhostMesh
  const ctor = namespace.default

  Object.assign(ctor, namespace, {
    default: ctor,
    P2PT: namespace.P2PT ?? ctor,
    FileSession: namespace.FileSession
  })

  root.GhostMesh = ctor
})()
`

for (const file of files) {
  const source = await readFile(file, 'utf8')

  if (source.includes('root.GhostMesh = ctor')) {
    continue
  }

  await writeFile(file, `${source}\n${footer}`, 'utf8')
}
