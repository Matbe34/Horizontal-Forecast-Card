import typescript from 'rollup-plugin-typescript2';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/horizontal-forecast-card.ts',
  output: {
    file: 'dist/horizontal-forecast-card.js',
    format: 'es',
    sourcemap: false,
    banner: '/* Horizontal Forecast Card v1.0.1 - https://github.com/Matbe34/Horizontal-Forecast-Card */',
  },
  external: ['lit', 'custom-card-helpers'],
  plugins: [
    resolve({
      preferBuiltins: false,
    }),
    typescript({
      typescript: require('typescript'),
      useTsconfigDeclarationDir: false,
      tsconfigOverride: {
        compilerOptions: {
          declaration: false,
          declarationMap: false,
        }
      }
    }),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
      presets: [
        ['@babel/preset-env', {
          targets: {
            browsers: ['> 1%', 'last 2 versions']
          }
        }]
      ],
    }),
    terser({
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        keep_fnames: true,
      },
    }),
  ],
};
