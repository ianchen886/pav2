/* global PA_EVALUATOR_ANALYTICS_SHEET_NAME, PA_FINAL_SCORES_SUMMARY_SHEET_NAME, PA_REPORT_ALL_RESPONSES_SHEET_NAME, PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME, PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME*/

/**
 * @file SheetUtils.js
 * @description This file provides utility functions for managing (primarily clearing)
 * various output sheets used in the Peer Assessment system. These functions are
 * typically invoked from the custom menu in Google Sheets.
 *
 * @requires Config.gs (for sheet name constants like PA_EVALUATOR_ANALYTICS_SHEET_NAME)
 */

// In SheetUtils.gs (or your chosen utility file)

/**
 * Clears all content from specified sheets. Optionally keeps headers.
 * If a sheet doesn't exist, it logs the event and continues.
 * Displays an alert summarizing the operation.
 *
 * @function clearSpecifiedSheets
 * @param {string[]} sheetNamesArray - An array of sheet names (strings) to be cleared.
 * @param {boolean} [keepHeaders=true] - If true (default), clears content from row 2 downwards.
 *                                      If false, clears the entire sheet including headers and formats.
 */

// This function is called by other functions in this file which are menu items.
// ESLint might not trace this usage back effectively, so we disable the warning.
function clearSpecifiedSheets(sheetNamesArray, keepHeaders = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi(); // Using SpreadsheetApp.getUi() for consistency
  let clearedCount = 0;
  let notFoundCount = 0;
  let sheetsClearedNames = [];

  if (!sheetNamesArray || sheetNamesArray.length === 0) {
    ui.alert("No Sheets Specified", "No sheet names were provided to clear.", ui.ButtonSet.OK);
    return;
  }

  sheetNamesArray.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      if (keepHeaders && sheet.getLastRow() > 0) {
        if (sheet.getLastRow() > 1) { 
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
        }
        Logger.log(`Cleared content (below headers) for sheet: "${sheetName}"`);
      } else if (!keepHeaders) {
        sheet.clearContents().clearFormats();
        Logger.log(`Cleared all content and formats for sheet: "${sheetName}"`);
      } else {
         Logger.log(`Sheet "${sheetName}" is empty or only has headers. No content cleared below headers.`);
      }
      clearedCount++;
      sheetsClearedNames.push(sheetName);
    } else {
      Logger.log(`Sheet "${sheetName}" not found. Skipping clear operation for this sheet.`);
      notFoundCount++;
    }
  });

  let message = "";
  if (clearedCount > 0) {
    message += `Cleared content for ${clearedCount} sheet(s): ${sheetsClearedNames.join(", ")}. `;
  }
  if (notFoundCount > 0) {
    message += `${notFoundCount} specified sheet(s) were not found.`;
  }
  if (message.trim() === "") { // Check if message is still effectively empty
    message = "No action taken: No sheets specified, found, or needing content cleared.";
  }
  ui.alert("Clear Sheets Operation", message, ui.ButtonSet.OK);
}

// --- Specific wrapper functions for menu items ---
// These functions are primarily entry points called from the Google Sheets custom menu.
// Therefore, they will appear as "unused" to ESLint's static analysis.
// We use eslint-disable-next-line to acknowledge this.

/**
 * Clears content (below headers) from the 'PaEvaluatorAnalytics' sheet.
 * Invoked from the custom menu.
 * @function clearEvaluatorAnalyticsSheet
 */
// eslint-disable-next-line no-unused-vars
function clearEvaluatorAnalyticsSheet() {
  clearSpecifiedSheets([PA_EVALUATOR_ANALYTICS_SHEET_NAME], true); 
}

/**
 * Clears content (below headers) from the 'PaFinalScoresSummary' sheet.
 * Invoked from the custom menu.
 * @function clearFinalScoresSummarySheet
 */
// eslint-disable-next-line no-unused-vars
function clearFinalScoresSummarySheet() {
  clearSpecifiedSheets([PA_FINAL_SCORES_SUMMARY_SHEET_NAME], true); 
}

/**
 * Clears content (below headers) from the 'PaReportAllResponses' sheet.
 * Invoked from the custom menu.
 * @function clearReportAllResponsesSheet
 */
// eslint-disable-next-line no-unused-vars
function clearReportAllResponsesSheet() {
  clearSpecifiedSheets([PA_REPORT_ALL_RESPONSES_SHEET_NAME], true);
}

/**
 * Clears content (below headers) from the 'PaReportMissingAssessments' sheet.
 * Invoked from the custom menu.
 * @function clearMissingAssessmentsReportSheet
 */
// eslint-disable-next-line no-unused-vars
function clearMissingAssessmentsReportSheet() {
  clearSpecifiedSheets([PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME], true);
}

/**
 * Clears content (below headers) from the 'PaVerificationMissingAssessments' sheet.
 * Invoked from the custom menu.
 * @function clearVerificationMissingAssessmentsSheet
 */
// eslint-disable-next-line no-unused-vars
function clearVerificationMissingAssessmentsSheet() {
  clearSpecifiedSheets([PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME], true);
}

/**
 * Prompts the user for confirmation and then clears content (below headers)
 * from all primary output/report sheets. Invoked from the custom menu.
 * @function clearALLOutputSheets
 */
// eslint-disable-next-line no-unused-vars
function clearALLOutputSheets() {
  const ui = SpreadsheetApp.getUi(); // Get Ui instance again, as it's good practice within the function
  const result = ui.alert(
    "Confirm Clear All",
    "Are you sure you want to clear all generated report and analytics sheets (content below headers)? This cannot be undone.",
    ui.ButtonSet.YES_NO
  );
  if (result === ui.Button.YES) {
    const sheetsToClear = [
      PA_EVALUATOR_ANALYTICS_SHEET_NAME,
      PA_FINAL_SCORES_SUMMARY_SHEET_NAME,
      PA_REPORT_ALL_RESPONSES_SHEET_NAME,
      PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME,
      PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME
    ];
    clearSpecifiedSheets(sheetsToClear, true); 
  } else {
    ui.alert("Clear Canceled", "Operation to clear all output sheets was canceled.", ui.ButtonSet.OK);
  }
}