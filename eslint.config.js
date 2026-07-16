import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Fail on unused vars/imports/helpers — allow `_`-prefixed intentional ignores.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-unused-private-class-members": "error",
      // Block accent-toggle remnants from reappearing.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Identifier[name=/^(useNewAccent|AccentToggle|ACCENT_HEX)$/]",
          message:
            "Accent toggle was removed. Use the `accent` design token instead of conditional accent logic.",
        },
        // Flag legacy heading-scale typography utilities. Use the semantic
        // aliases: text-display / text-h1..h6 / text-title / text-subtitle
        // instead of raw text-fs-xl / -2xl / -3xl / -4xl / -5xl / -6xl on
        // heading elements.
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\btext-fs-(xl|[2-6]xl)\\b/]",
          message:
            "Legacy heading size class. Replace text-fs-xl/2xl/3xl/4xl/5xl/6xl with the semantic alias: text-subtitle, text-title, text-h3, text-h2, text-h1, or text-display.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\btext-fs-(xl|[2-6]xl)\\b/]",
          message:
            "Legacy heading size class in template literal. Replace text-fs-xl/2xl/3xl/4xl/5xl/6xl with a semantic alias (text-subtitle / text-title / text-h1..h3 / text-display).",
        },
        {
          // Catches `cn(\"text-fs-2xl ...\", ...)` and `clsx(...)` helpers.
          selector:
            "CallExpression[callee.name=/^(cn|clsx|classnames|twMerge|cva)$/] Literal[value=/\\btext-fs-(xl|[2-6]xl)\\b/]",
          message:
            "Legacy heading size class inside cn()/clsx()/cva(). Replace text-fs-xl/2xl/3xl/4xl/5xl/6xl with a semantic alias (text-subtitle / text-title / text-h1..h3 / text-display).",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/AccentToggle", "**/accent-toggle*"],
              message:
                "Accent toggle was removed. Use the `accent` design token instead.",
            },
          ],
        },
      ],
    },
  },
  // Allow unused vars in tests/stories/setup files where fixtures often go unused.
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.stories.{ts,tsx}",
      "**/__tests__/**",
      "src/test/**",
      "e2e/**",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
);
