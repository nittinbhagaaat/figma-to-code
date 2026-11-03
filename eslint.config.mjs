// JavaScript-only lint setup (no TypeScript toolchain): Next.js rules + React Hooks + accessibility.
import next from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";

export default [
  { ignores: [".next/**", "node_modules/**", "public/**", ".data/**", "out/**"] },
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } }, globals: { process: "readonly", Buffer: "readonly", console: "readonly", window: "readonly", document: "readonly", fetch: "readonly", URL: "readonly", FormData: "readonly", Response: "readonly", Request: "readonly", AbortSignal: "readonly", setTimeout: "readonly", clearTimeout: "readonly", localStorage: "readonly", navigator: "readonly", location: "readonly", Blob: "readonly", atob: "readonly", structuredClone: "readonly", ResizeObserver: "readonly", URLSearchParams: "readonly", Uint8Array: "readonly", DataView: "readonly", TextDecoder: "readonly", globalThis: "readonly", require: "readonly", crypto: "readonly" } },
    plugins: { "@next/next": next, "react-hooks": reactHooks, "jsx-a11y": jsxA11y, react },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_|^React$" }],
      "no-undef": "error",
    },
  },
];
