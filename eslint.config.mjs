import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // Root config files: CommonJS in a Node environment.
  {
    files: ['*.config.js'],
    ...js.configs.recommended,
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },

  // Extension source.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      // no-undef is turned off by typescript-eslint (tsc already covers it),
      // so only globals that are not typed as such are needed here.
      globals: { chrome: 'readonly' },
    },
    rules: {
      // The two checks that catch real bugs in effects and callbacks:
      // conditionally called hooks and missing dependencies.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // `!= null` is used on purpose to cover null and undefined at once.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
);
