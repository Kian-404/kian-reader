import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import createVueTsConfig from '@vue/eslint-config-typescript'

export default [
  {
    ignores: ['dist/**', 'android/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  ...createVueTsConfig({ extends: ['recommended'] }),
  {
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/no-deprecated-slot-attribute': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
