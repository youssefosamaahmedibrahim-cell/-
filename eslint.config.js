export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        matchMedia: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly',
        devicePixelRatio: 'readonly', addEventListener: 'readonly', setTimeout: 'readonly',
        clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        AudioContext: 'readonly', globalThis: 'readonly', performance: 'readonly',
        WebGLRenderingContext: 'readonly', fetch: 'readonly', URL: 'readonly',
        Image: 'readonly', getComputedStyle: 'readonly', console: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
    },
  },
];
