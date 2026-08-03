import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 时区防御：禁止用 toISOString() 截取"日期"（UTC 与本地时区错位，UTC+8 每晚 20:00 后错一天）
  // 一律改用 src/lib/date.ts 的 localDateStr()
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.property.name="split"] MemberExpression[object.callee.property.name="toISOString"]',
          message: "禁止 toISOString().split() 取日期：返回 UTC 会时区错位，改用 localDateStr()",
        },
        {
          selector: 'CallExpression[callee.property.name="slice"] MemberExpression[object.callee.property.name="toISOString"]',
          message: "禁止 toISOString().slice() 取日期：返回 UTC 会时区错位，改用 localDateStr()",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
