/**
 * @jest-config-loader ts-node
 * @jest-config-loader-options {"transpileOnly":true,"compilerOptions":{"module":"CommonJS","moduleResolution":"Node","verbatimModuleSyntax":false,"ignoreDeprecations":"6.0"}}
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  clearMocks: true,
  coverageProvider: 'v8',
};

export default config;
