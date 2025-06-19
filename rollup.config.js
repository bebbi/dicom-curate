import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';

const plugins = [
  typescript({
    tsconfig: './tsconfig.json',
    moduleResolution: 'node',
    outDir: 'dist',
    declaration: false,
  }),
  nodeResolve(),
  commonjs(),
  nodePolyfills(),
  terser()  
];

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/dicom-curate.umd.min.js',
      format: 'umd',
      name: 'dicomCurate',
      sourcemap: true
    },
    plugins,
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/esm/dicom-curate.esm.js',
      format: 'esm',
      sourcemap: true
    },
    plugins,
  }
];
