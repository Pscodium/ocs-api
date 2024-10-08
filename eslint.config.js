const eslintRecommended = require('@eslint/js');

export default [
    eslintRecommended,
    {
        files: ["*.js"],
        languageOptions: {
            ecmaVersion: 8,
            sourceType: "module",
        },
        env: {
            node: true,
            es6: true,
            mocha: true
        },
        rules: {
            "no-console": "off",
            "guard-for-in": "error",
            "semi": ["error", "always"],
            "no-loop-func": "error",
            "no-sync": "error",
            "no-template-curly-in-string": "error",
            "block-scoped-var": "error",
            "dot-notation": "error",
            "curly": "error",
            "no-var": "error",
            "no-unused-vars": "error",
            "prefer-const": "error",
            "no-trailing-spaces": "error",
            "no-irregular-whitespace": "error",
            "space-infix-ops": "error",
            "brace-style": "error",
            "comma-spacing": "error",
            "key-spacing": "off",
            "space-before-blocks": "error",
            "no-multi-spaces": "error",
            "indent": [
                "error",
                4,
                {
                    "SwitchCase": 1
                }
            ]
        },
        ignores: ["tailwind.config.js"]
    }
];