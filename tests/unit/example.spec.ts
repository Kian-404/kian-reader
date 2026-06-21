import { mount } from '@vue/test-utils'
import HomePage from '@/views/LibraryPage.vue'
import { describe, expect, test, vi } from 'vitest'
import { createPinia } from 'pinia'
import { IonicVue } from '@ionic/vue'

// Mock parser to avoid pdfjs-dist / epubjs Node.js compatibility issues
vi.mock('../src/utils/parser', () => ({
  extractMetadata: vi.fn().mockResolvedValue({ title: 'Test', author: 'Author' }),
}))

describe('LibraryPage.vue', () => {
  test('renders empty library state', () => {
    const wrapper = mount(HomePage, {
      global: {
        plugins: [createPinia(), IonicVue],
        stubs: {
          'ion-page': { template: '<div><slot /></div>' },
          'ion-header': { template: '<header><slot /></header>' },
          'ion-content': { template: '<main><slot /></main>' },
          'ion-toolbar': { template: '<div><slot /></div>' },
          'ion-title': { template: '<span><slot /></span>' },
          'ion-buttons': { template: '<div><slot /></div>' },
        },
      },
    })
    expect(wrapper.text()).toContain('开启您的阅读之旅')
  })
})
