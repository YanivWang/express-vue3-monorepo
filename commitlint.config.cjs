/**
 * Conventional Commits；scope 与仓库包 / 目录对齐。
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "rest-api",
        "pc-portal",
        "pc-admin",
        "shared",
        "request-core",
        "js-bridge",
        "web-monitor",
        "repo",
        "deps",
        "docker",
        "frontend",
        "backend",
      ],
    ],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 100],
  },
};
