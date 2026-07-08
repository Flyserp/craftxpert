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
        "error",
        {
          selector: "Identifier[name=/^(useNewAccent|AccentToggle|ACCENT_HEX)$/]",
          message:
            "Accent toggle was removed. Use the locked `brand-accent` design token instead of conditional accent logic.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/AccentToggle", "**/accent-toggle*"],
              message:
                "Accent toggle was removed. Use the locked `brand-accent` design token instead.",
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
