// Vitest setup — polyfill browser APIs needed by pdfjs-dist
if (typeof globalThis.DOMMatrix === 'undefined') {
  class MockDOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    constructor() { /* noop */ }
    translate() { return this }
    scale() { return this }
    rotate() { return this }
    multiply() { return this }
    inverse() { return this }
    transformPoint() { return { x: 0, y: 0, z: 0, w: 1 } }
    toFloat64Array() { return new Float64Array(16) }
    toFloat32Array() { return new Float32Array(16) }
    toString() { return 'matrix(1,0,0,1,0,0)' }
  }
  globalThis.DOMMatrix = MockDOMMatrix as any
}

// Polyfill localStorage for jsdom (needs --localstorage-file flag otherwise)
{
  const store: Record<string, string> = {}
  const mock: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true })
}
