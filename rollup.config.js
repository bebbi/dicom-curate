import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node'; // Added import

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/dicom-curate.umd.min.js',
    format: 'umd',
    name: 'dicomCurate',
    sourcemap: true, // Optional: include sourcemaps
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json', // Ensure this path is correct
      moduleResolution: 'node', // Or 'classic', depending on your tsconfig
      outDir: 'dist', // Align with Rollup's output.file
      declaration: false, // Avoid issues with declaration output for UMD
    }),
    nodeResolve(),
    commonjs(),
    nodePolyfills(), // Added plugin
    terser() // For minification
  ],
  // Externalize peer dependencies if any, or ensure all are bundled
  // external: ['peer-dependency'],
};
