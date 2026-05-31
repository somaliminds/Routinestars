module.exports = {
  extends: ['expo', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    // Quality Rule 1: No 'any' types
    '@typescript-eslint/no-explicit-any': 'error',
    // Quality Rule 7: No sensitive data in logs
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Enforce i18n readiness — no raw string literals in JSX
    'react/jsx-no-literals': 'off',
    // Accessibility — inline styles permitted when NativeWind className is not enough
  },
};
