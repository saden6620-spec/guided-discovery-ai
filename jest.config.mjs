/** @type {import("jest").Config} */
const config = {
  collectCoverageFrom: [],
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/tests/javascript/**/*.test.cjs",
    "<rootDir>/packages/**/__tests__/**/*.test.cjs",
  ],
};

export default config;
