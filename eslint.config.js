// Copyright (c) Meta Platforms, Inc. and affiliates.

import {defineConfig} from 'eslint/config';
import {includeIgnoreFile} from '@eslint/compat';
import path from 'node:path';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import reactCompiler from 'eslint-plugin-react-compiler';
import astryxPlugin from './internal/eslint-plugin-astryx/index.js';

/* global process */

/**
 * Astryx ESLint Configuration
 *
 * Two-tier linting philosophy:
 * - CI/Agents: Strict mode (errors) - Set ASTRYX_STRICT_LINT=1 or CI=true
 * - Humans: Recommended mode (warnings) - Default for local development
 *
 * Usage:
 *   pnpm lint                    # Human mode (warnings)
 *   ASTRYX_STRICT_LINT=1 pnpm lint  # Strict mode (errors)
 *   CI=true pnpm lint            # Also triggers strict mode
 */

const isStrictMode =
  process.env.ASTRYX_STRICT_LINT === '1' || process.env.CI === 'true';
const astryxConfig = isStrictMode
  ? astryxPlugin.configs.strict
  : astryxPlugin.configs.recommended;
const reactSeverity = isStrictMode ? 'error' : 'warn';

// The internal plugin is plain untyped JS (kept out of the lint/type surface),
// so its inferred shape doesn't satisfy ESLint's strict `Plugin` type. One
// localized assertion here keeps every `plugins` entry below type-checked.
const astryxEslintPlugin = /** @type {import('eslint').ESLint.Plugin} */ (
  /** @type {unknown} */ (astryxPlugin)
);

/**
 * Reuse a `.gitignore` as lint ignores, so generated and vendored files are
 * never linted. Without this, anything git ignores but that exists on disk
 * gets linted the moment you generate it — e.g. `apps/docsite/public/monaco`
 * (25MB of minified Monaco + the TS compiler, copied in by
 * `scripts/copy-vendor.mjs`) produced ~23.5k errors for anyone who had run
 * the docsite. CI never saw it: it lints a fresh checkout, where the
 * generated files don't exist yet.
 *
 * Patterns in a nested `.gitignore` are relative to that file, so each one
 * needs its directory as `basePath`.
 */
const gitignoreDirs = [
  'apps/docsite',
  'apps/sandbox',
  'apps/template-viewer',
  'internal/vibe-tests',
  'packages/build',
  'packages/cli',
];

const gitignores = [
  includeIgnoreFile(
    path.join(import.meta.dirname, '.gitignore'),
    'root .gitignore',
  ),
  ...gitignoreDirs.map(dir => ({
    basePath: dir,
    ...includeIgnoreFile(
      path.join(import.meta.dirname, dir, '.gitignore'),
      `${dir}/.gitignore`,
    ),
  })),
];

// typescript-eslint ≥8.62 types its presets with loose cross-version
// "compatibility" shapes (`CompatibleConfig` = `{name?, rules?: object}`);
// normalize back to ESLint's own config type for `defineConfig`.
const tseslintRecommended = /** @type {import('eslint').Linter.Config[]} */ (
  tseslint.configs.recommended
);

export default defineConfig(
  js.configs.recommended,
  tseslintRecommended,
  ...gitignores,
  {
    ignores: [
      // dist/** and node_modules/** come from the .gitignore imports above.
      '.claude/**',
      '**/internal/eslint-plugin-astryx/**',
      '.github/scripts/**',
      'scripts/**',
      // Canonical consumer fixtures are validated and built in copied,
      // standalone sandboxes rather than linted as workspace source.
      'internal/vibe-tests/fixtures/**',
      // Changesets tooling (custom changelog module + config) is CommonJS
      // build/release glue, not shipped source — keep it out of the TS/ESM
      // lint pass (consistent with scripts/** above).
      '.changeset/**',
      // .mjs is ignored everywhere EXCEPT the CLI package, whose runtime is
      // entirely .mjs. The negations below opt packages/cli back into linting
      // (see the dedicated CLI block lower down). Scoped to packages/cli on
      // purpose — other packages' .mjs stay unlinted (#2468).
      '**/*.mjs',
      '!packages/cli/api/**/*.mjs',
      '!packages/cli/clients/cli/**/*.mjs',
      '!packages/cli/assets/codemods/**/*.mjs',
      '!packages/cli/authoring/**/*.mjs',
      '!packages/cli/lib/**/*.mjs',
      '!packages/cli/utils/**/*.mjs',
      '!packages/cli/foundation/**/*.mjs',
      '!packages/cli/clients/cli/bin/**/*.mjs',
      '**/*.test-violations.tsx',
      'apps/example-nextjs/*.js',
      // Generated declaration files (e.g. the CLI's `./api` type surface emitted
      // from JSDoc by `sync:api-types` at prepack). Like `**/*.d.ts`, these are
      // build artifacts — not hand-authored source to lint.
      '**/*.d.mts',
      '**/next-env.d.ts',
      '**/.next/**',
      'apps/example-nextjs-source/*.js',
      'apps/docsite/*.js',
      'apps/docsite/scripts/**',
      'apps/sandbox/*.js',
      'apps/sandbox/out/**',
      'packages/build/**',
    ],
  },;
