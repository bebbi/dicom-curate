import esbuild from 'esbuild'

const buildOptions = {
  entryPoints: [
    'src/index.ts',
    'src/scanDirectoryWorker.ts',
    'src/applyMappingsWorker.ts',
  ],
  bundle: true,
  format: 'esm',
  outdir: 'dist/esm',
  sourcemap: true,
  target: 'es2020',
  platform: 'browser',
  external: [],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: false, // Keep readable for debugging
  metafile: true, // Generate build analysis
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
