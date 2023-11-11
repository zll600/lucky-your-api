module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
  },
  'globals': {
    'process': true,
    '__dirname': true,
    'Buffer': true,
    'debug': true,
  },
  
  // 'extends': 'eslint:recommended',
  'parserOptions': {
    'ecmaVersion': 13,
  },
  'rules': {
    'indent': [
      'error',
      2,
    ],
    'linebreak-style': [
      'error',
      'unix',
    ],
    'quotes': [
      'error',
      'single',
    ],
    'semi': [
      'error',
      'never',
    ],
    'space-before-blocks': [2, 'always'],
    'padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: '*', next: 'return' },
      { blankLine: 'always', prev: 'function', next: 'function' },
      { blankLine: 'always', prev: 'block', next: 'block' },
    ],
    'comma-dangle': ['error', 'always-multiline'],
    'max-len': [
      'error',
      120,
      2,
      {
        'ignoreComments': true,
        'ignoreUrls': true,
        'ignoreStrings': true,
        'ignoreTemplateLiterals': true,
        'ignoreRegExpLiterals': true,
      },
    ],
    'no-unused-vars': [
      'error',
      {
        'args': 'after-used',
        'argsIgnorePattern': '^_',
        'ignoreRestSiblings': true,
        'vars': 'local',
        'varsIgnorePattern': '^_',
      },
    ],
    'operator-linebreak': ['error', 'before', {
      'overrides': {
        '=': 'none',
      },
    }],
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always',
    }],
  },
}
