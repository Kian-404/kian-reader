import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import createVueTsConfig from '@vue/eslint-config-typescript'

export default [
  {
    ignores: [
      '**/.DS_Store',
      '**/node_modules',
      'coverage',
      'dist',
      'ios',
      'android',
      'public/pdf.worker.mjs',
      '*.local',
      '*.sw?',
      '*.suo',
      '*.ntvs*',
      '*.njsproj',
      '*.sln',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      'pnpm-debug.log*',
      '.idea',
      '.vscode',
    ],
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  ...createVueTsConfig({ extends: ['recommended'] }),
  {
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/no-deprecated-slot-attribute': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
      'import/no-unresolved': 'off',
    },
  },
]
