import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import nodePolyfills from 'rollup-plugin-polyfill-node'

export default {
  input: 'src/index.ts',
  treeshake: false, // disable tree-shaking
  output: {
    file: 'dist/umd/dicom-curate.umd.js', // no minification
    format: 'umd',
    name: 'dicomCurate',
    sourcemap: true,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationDir: undefined,
      outDir: 'dist',
    }),
    nodeResolve(),
    commonjs(),
    nodePolyfills(),
  ],
}
