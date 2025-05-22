// closure-checker.js
import { parse } from 'acorn'
import globals from 'acorn-globals'

const DEFAULT_GLOBALS: Set<string> = new Set([
  'Math',
  'Date',
  'JSON',
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'RegExp',
  'Error',
])

/*
 * Analyze a function for:
 *   - closures (free vars not on globalThis)
 *   - globalsUsed (identifiers on globalThis but not in DEFAULT_GLOBALS)
 *
 * @param {Function} fn
 * @returns {{ closures: string[], globalsUsed: string[] }}
 */
function hasClosure(fn: Function) {
  const src = `(${fn.toString()})`
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  const allNames = Array.from(new Set(globals(ast).map((g) => g.name)))

  const closures = allNames.filter(
    (name) => !DEFAULT_GLOBALS.has(name) && !(name in globalThis),
  )

  const globalsUsed = allNames.filter(
    (name) => !DEFAULT_GLOBALS.has(name) && name in globalThis,
  )

  return { closures, globalsUsed }
}

/*
 * Throws on either:
 *   - forbidden globalThis use
 *   - any true closures
 *
 * @param {Function} fn
 * @throws {Error}
 */
export function assertNoClosure(fn: Function) {
  const { closures, globalsUsed } = hasClosure(fn)

  if (globalsUsed.length) {
    throw new Error(`Forbidden globals usage: ${globalsUsed.join(', ')}`)
  }
  if (closures.length) {
    throw new Error(
      `Function cannot be serialized due to closed-over variables: ${closures.join(', ')}`,
    )
  }
}
