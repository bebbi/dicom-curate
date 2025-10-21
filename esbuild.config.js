import esbuild from 'esbuild'
import { readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

// Function to recursively find TypeScript files, excluding tests and @types
function findEntryPoints(dir, baseDir = '') {
  const entries = []
  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const relativePath = join(baseDir, item)

    if (statSync(fullPath).isDirectory()) {
      // Skip @types directory
      if (item === '@types') continue

      // Recursively search subdirectories
      entries.push(...findEntryPoints(fullPath, relativePath))
    } else if (extname(item) === '.ts') {
      // Skip test files
      if (item.endsWith('.test.ts') || item.endsWith('.spec.ts')) continue

      // Add as entry point
      entries.push(`src/${relativePath}`)
    }
  }

  return entries
}

// Get entry points dynamically
const entryPoints = findEntryPoints('src')

const buildOptions = {
  entryPoints,
  format: 'esm',
  outdir: 'dist/esm',
  bundle: true,
  sourcemap: false, // Set to false to disable source maps
  target: 'es2020',
  platform: 'node', // Use node platform to resolve npm packages
  external: [
    'fs', // Node.js built-in modules
    'path',
    'os',
    'crypto',
    'stream',
    'util',
    'buffer',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: false, // Keep readable for debugging
  metafile: true, // Generate build analysis
  banner: {
    js: `
// Conditionally create require for Node.js environment
// This will only work in Node.js and fail gracefully in browsers
const require = typeof process !== 'undefined' && typeof process.versions?.node !== 'undefined'
  ? (await import('module')).createRequire(import.meta.url)
  : undefined;
`,
  },
}

// Build function
async function build() {
  try {
    const result = await esbuild.build(buildOptions)
    console.log('✅ ESM build completed successfully')

    if (result.metafile) {
      const analysis = await esbuild.analyzeMetafile(result.metafile)
      console.log(analysis)
    }
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

// Watch mode
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(buildOptions)
  await context.watch()
  console.log('👀 Watching for changes...')
} else {
  build()
}
