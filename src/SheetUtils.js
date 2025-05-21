// In SheetUtils.gs (or your chosen utility file)

/**
 * Clears all content and formatting from specified sheets, leaving headers if they exist.
 * If the sheet doesn't exist, it does nothing for that sheet.
 * @param {string[]} sheetNamesArray - An array of sheet names to clear.
 * @param {boolean} [keepHeaders=true] - If true, clears from row 2 downwards. If false, clears entire sheet.
 */
function clearSpecifiedSheets(sheetNamesArray, keepHeaders = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
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
        // Clear content from row 2 downwards, but keep formatting unless specified
        if (sheet.getLastRow() > 1) { // Only if there's data beyond headers
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
        }
        // Optionally clear formats too if desired, or just leave them:
        // sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearFormat();
        Logger.log(`Cleared content (below headers) for sheet: "${sheetName}"`);
      } else if (!keepHeaders) {
        // Clear entire sheet including headers and formats
        sheet.clearContents().clearFormats();
        Logger.log(`Cleared all content and formats for sheet: "${sheetName}"`);
      } else {
        // Sheet exists but is empty or only has headers, nothing to clear below headers
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
  if (!message) {
    message = "No sheets were specified or found to clear.";
  }
  ui.alert("Clear Sheets Operation", message, ui.ButtonSet.OK);
}

// --- Specific wrapper functions for menu items ---

function clearEvaluatorAnalyticsSheet() {
  clearSpecifiedSheets([PA_EVALUATOR_ANALYTICS_SHEET_NAME], true); // keepHeaders = true
}

function clearFinalScoresSummarySheet() {
  clearSpecifiedSheets([PA_FINAL_SCORES_SUMMARY_SHEET_NAME], true); // true to keep headers, as the main function repopulates them if needed
}

function clearReportAllResponsesSheet() {
  clearSpecifiedSheets([PA_REPORT_ALL_RESPONSES_SHEET_NAME], true);
}

function clearMissingAssessmentsReportSheet() {
  clearSpecifiedSheets([PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME], true);
}

function clearVerificationMissingAssessmentsSheet() {
  clearSpecifiedSheets([PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME], true);
}

function clearALLOutputSheets() {
  const ui = SpreadsheetApp.getUi();
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
    clearSpecifiedSheets(sheetsToClear, true); // keepHeaders = true
  } else {
    ui.alert("Clear Canceled", "Operation to clear all output sheets was canceled.", ui.ButtonSet.OK);
  }
}