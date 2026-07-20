import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@erp/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@erp/organization-io$': '<rootDir>/../../packages/organization-io/dist/index.js',
  },
  testTimeout: 60000,
};

export default config;
