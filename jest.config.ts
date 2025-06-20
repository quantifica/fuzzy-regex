/* eslint-disable */
export default {
  displayName: "fuzzy-regex",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "./tre.node": "<rootDir>/build/Release/tre.node",
  },
  transformIgnorePatterns: ["node_modules"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        useESM: true,
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "html"],
};
