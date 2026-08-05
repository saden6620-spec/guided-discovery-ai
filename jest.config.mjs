/** @type {import("jest").Config} */
const config = {
  collectCoverageFrom: [],
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/tests/javascript/**/*.test.cjs",
    "<rootDir>/packages/**/__tests__/**/*.test.cjs",
    "<rootDir>/backend/memory-service/__tests__/**/*.test.cjs",
    "<rootDir>/backend/planning-service/__tests__/**/*.test.cjs",
    "<rootDir>/backend/navigation-service/__tests__/**/*.test.cjs",
    "<rootDir>/backend/recommendation-service/__tests__/**/*.test.cjs",
    "<rootDir>/backend/documentation-service/__tests__/**/*.test.cjs",
  ],
};

export default config;
