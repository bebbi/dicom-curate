import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import { terser } from 'rollup-plugin-terser'

const basePlugins = [
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    outDir: 'dist',
  }),
  nodeResolve(),
  commonjs(),
  nodePolyfills(),
]

export default [
  // UMD build – non-minified
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/dicom-curate.umd.js',
      format: 'umd',
      name: 'dicomCurate',
      sourcemap: true,
      globals: {
        fs: 'fs',
        'fs/promises': 'fs.promises',
        path: 'path',
        worker_threads: 'worker_threads',
      },
    },
    external: ['fs', 'fs/promises', 'path', 'worker_threads'],
    plugins: basePlugins,
  },

  // UMD build - minified
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/dicom-curate.umd.min.js',
      format: 'umd',
      name: 'dicomCurate',
      sourcemap: true,
      globals: {
        fs: 'fs',
        'fs/promises': 'fs.promises',
        path: 'path',
        worker_threads: 'worker_threads',
      },
    },
    external: ['fs', 'fs/promises', 'path', 'worker_threads'],
    treeshake: true,
    plugins: [...basePlugins, terser()],
  },
]
