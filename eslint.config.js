import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/.next/**", "**/node_modules/**", "**/dist/**", "**/build/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      // Existing API handlers still contain legacy explicit-any annotations.
      // Keep them visible during the MVP hardening pass without blocking the
      // rest of the repository quality gates. New code should use real types.
      "@typescript-eslint/no-explicit-any": "warn",
      "no-debugger": "error",
      "no-console": ["error", { allow: ["error", "warn"] }],
    },
  },
);
