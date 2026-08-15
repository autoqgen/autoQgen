import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*"],
              message: "Use the @/* path alias instead of deep relative imports.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "Import the validated config from @/lib/config/env instead of reading process.env directly.",
        },
      ],
    },
  },
  {
    files: [
      "src/lib/config/env.ts",
      // Edge middleware must read the raw secret for getToken() and cannot pull
      // the Node-oriented config module into the edge bundle.
      "src/middleware.ts",
      "scripts/**/*.ts",
      "tests/**/*.ts",
      "e2e/**/*.ts",
      "*.config.ts",
      "*.config.mjs",
    ],
    rules: {
      "no-restricted-syntax": "off",
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
