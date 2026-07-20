import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'build-ts/**', '.husky/**', 'static/**'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },
  prettierRecommended,
  {
    rules: {
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'never'],
      'no-extra-boolean-cast': 'off',
      'no-unused-vars': [
        'warn',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
        },
      ],
      'prettier/prettier': [
        'error',
        {
          trailingComma: 'all',
          singleQuote: true,
          tabWidth: 2,
          semi: false,
          printWidth: 100,
        },
      ],
    },
  },
]
