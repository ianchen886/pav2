// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals"; // For standard 'browser', 'node' globals etc.
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Configuration for ALL your JavaScript (Apps Script .gs) files in src/
  {
    files: ["src/**/*.js"], // Applies to all .js files in your src directory
    languageOptions: {
      ecmaVersion: "latest", // Use modern JavaScript syntax features
      sourceType: "script",  // Apps Script files are typically global scripts
      globals: {
        // --- Standard Environment Globals ---
        ...globals.browser, // Includes things like console, setTimeout, etc.
                            // Logger is preferred over console in Apps Script, but browser globals are a common base.
        // ...globals.node, // Probably not needed if you're not doing Node.js specific things.

        // --- Google Apps Script Service Globals (Essential) ---
        "SpreadsheetApp": "readonly",
        "Logger": "readonly",
        "Utilities": "readonly",
        "HtmlService": "readonly",
        "PropertiesService": "readonly",
        "Session": "readonly",
        "CacheService": "readonly",
        "UrlFetchApp": "readonly",
        "MailApp": "readonly",
        "DriveApp": "readonly",
        "DocumentApp": "readonly",
        "FormApp": "readonly",
        "SitesApp": "readonly",
        "CalendarApp": "readonly",
        "ContentService": "readonly",
        "ChartsService": "readonly",
        "Ui": "readonly", // For SpreadsheetApp.getUi()
        // Add any other core GAS services you might use directly (e.g., "SlidesApp", "LanguageApp")

        // --- Project-Specific Globals (Constants/Functions from other files) ---
        // These will now be handled by /* global ... */ comments in individual files.
        // So, this section in eslint.config.mjs will be empty or removed for project specifics.
      }
    },
    rules: {
      // Start with ESLint's recommended set of rules
      ...js.configs.recommended.rules,

      // Your Custom Rules / Overrides
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_", // Allow unused function arguments if they start with _
        "varsIgnorePattern": "^_"  // Allow unused variables if they start with _
      }],
      // "indent": ["error", 2], // Example: enforce 2-space indentation
      // "semi": ["error", "always"], // Example: require semicolons
      
      // NOTE: 'no-redeclare' is part of js.configs.recommended.rules and should remain active.
      // By not listing your project functions (createStudent etc.) in 'globals' here,
      // 'no-redeclare' will NOT error in the files where they are defined (e.g., Models.js).
    }
  },

  // Optional: If you want to completely ignore linting for certain files
  // (like the old Parser_V1.js if you're keeping it for reference only)
  // {
  //   ignores: ["src/Parser_V1.js"] 
  // }
]);