import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files
    dir: "./",
});

const config: Config = {
    displayName: "Smart Split",
    testEnvironment: "jsdom",
    testTimeout: 10000, // 10 second timeout per test
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    testPathIgnorePatterns: [
        "<rootDir>/node_modules/",
        "<rootDir>/.next/",
    ],
    // Transform ES modules from these packages
    transformIgnorePatterns: [
        "/node_modules/(?!(uncrypto|@upstash)/)",
    ],
    // Use V8 coverage provider (compatible with Jest 30)
    coverageProvider: "v8",
    collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/index.ts",
        "!src/types/**/*",
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
};

export default createJestConfig(config);
