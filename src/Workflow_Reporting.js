/* global PA_REPORT_ALL_RESPONSES_SHEET_NAME, PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME, PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME, parseRawSurveyData, generateEvaluatorAnalyticsAndWeights, isValidProductionUnit*/ 

/**
 * @file Workflow_Reporting.js
 * @description This file contains functions dedicated to generating various reports
 * for the Peer Assessment system. These include a raw scores report, a report on
 * missing assessments, and a verification utility for the missing assessments report.
 * These functions are typically invoked from the custom menu in Google Sheets.
 *
 * @requires Config.gs (for various PA_..._SHEET_NAME constants)
 * @requires Parser_V2.js (for parseRawSurveyData function)
 * @requires Workflow_Analytics.js (for generateEvaluatorAnalyticsAndWeights function)
 * @requires Utils.js (for isValidProductionUnit function)
 */

/**
 * Generates a detailed report of all individual raw responses submitted by students.
 * This report includes the timestamp, evaluated student details, question details,
 * response type (SCORE/COMMENT), response value, evaluator details, the evaluator's
 * calculated weight (from {@link generateEvaluatorAnalyticsAndWeights}), and the unit
 * context of the evaluation. The output is written to the 'PaReportAllResponses' sheet.
 * This function is invoked from the custom menu.
 *
 * @function generateRawScoresReportWithWeights
 */
// eslint-disable-next-line no-unused-vars
function generateRawScoresReportWithWeights() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- Starting Raw Scores Report Generation (camelCase Headers, with Weights, using V2 Parser) ---");

  const reportSheetName = PA_REPORT_ALL_RESPONSES_SHEET_NAME;

  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses || !parsedData.questions) {
    const errorMsg = "ERROR: V2 Parser did not return expected data for raw scores report.";
    Logger.log(errorMsg);
    throw new Error("Could not parse necessary data using V2 parser. Cannot generate raw scores report.");
  }
  const { students: allStudents, questions, responses } = parsedData;
  
  const evaluatorWeights = generateEvaluatorAnalyticsAndWeights(); 
  if (!evaluatorWeights) {
      Logger.log("Warning: Evaluator weights not available (function returned null). Weights column will show 'N/A' or default.");
  } else if (Object.keys(evaluatorWeights).length === 0) {
      Logger.log("Info: Evaluator weights object is empty. Weights column will show 'N/A' or default.");
  }

  if (responses.length === 0 && Object.keys(allStudents).length === 0){ 
    const errorMsg = "No student or response data available for raw scores report (V2 Parser).";
    Logger.log(errorMsg);
    throw new Error("No students or responses found after V2 parsing. Raw scores report not generated.");
  }
  Logger.log(`Generating raw scores report from ${responses.length} responses (V2 Parser).`);

  let reportSheet = ss.getSheetByName(reportSheetName);
  if (reportSheet) {
    Logger.log(`Sheet "${reportSheetName}" found. Clearing all contents and formats.`);
    reportSheet.clearContents().clearFormats();
  } else {
    reportSheet = ss.insertSheet(reportSheetName);
    Logger.log(`Sheet "${reportSheetName}" created.`);
  }

  const headers = [
    "timestamp", "evaluatedStudentId", "evaluatedStudentName", 
    "questionId", "questionPrompt", "responseType", "responseValue", 
    "evaluatorId", "evaluatorName", "evaluatorWeight", "unitContextOfEvaluation"
  ];
  
  reportSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  reportSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setHorizontalAlignment("center");
  reportSheet.setFrozenRows(1);
  Logger.log(`Populated camelCase headers in "${reportSheetName}".`);

  const outputRows = [];
  for (const response of responses) {
    const evaluatedStudentInfo = allStudents[response.evaluatedStudentId] || { studentName: `[Orphaned ID: ${response.evaluatedStudentId || 'N/A'}]` };
    const evaluatorStudentInfo = allStudents[response.responseByStudentId] || { studentName: `[Orphaned ID: ${response.responseByStudentId || 'N/A'}]` };
    const questionInfo = questions[response.responseToQuestionId] || { questionPrompt: `[Unknown Question ID: ${response.responseToQuestionId || 'N/A'}]` };
    
    let evaluatorWeightValue = "N/A";
    if (evaluatorWeights && response.responseByStudentId && evaluatorWeights[response.responseByStudentId] !== undefined) {
        const w = evaluatorWeights[response.responseByStudentId];
        evaluatorWeightValue = (typeof w === 'number' && !isNaN(w)) ? w : "N/A";
    }

    outputRows.push([
      response.timestamp, 
      response.evaluatedStudentId || "", 
      evaluatedStudentInfo.studentName, 
      response.responseToQuestionId || "",
      questionInfo.questionPrompt, 
      response.responseType || "", 
      response.responseValue,
      response.responseByStudentId || "", 
      evaluatorStudentInfo.studentName, 
      evaluatorWeightValue,
      response.unitContextOfEvaluation || ""
    ]);
  }

  if (outputRows.length > 0) { 
    reportSheet.getRange(2, 1, outputRows.length, headers.length).setValues(outputRows)
               .setVerticalAlignment("middle").setHorizontalAlignment("left"); 
    
    const centerAlignHeaders = ["evaluatedStudentId", "questionId", "responseType", "evaluatorId", "evaluatorWeight", "unitContextOfEvaluation"];
    centerAlignHeaders.forEach(headerName => {
        const colIdx = headers.indexOf(headerName);
        if (colIdx !== -1) {
            reportSheet.getRange(2, colIdx + 1, outputRows.length, 1).setHorizontalAlignment("center");
        }
    });
    // Ensure timestamp column exists before formatting
    const timestampColIdx = headers.indexOf("timestamp");
    if (timestampColIdx !== -1) {
        reportSheet.getRange(2, timestampColIdx + 1, outputRows.length, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    }
    // Ensure evaluatorWeight column exists before formatting
    const weightColIdx = headers.indexOf("evaluatorWeight");
    if (weightColIdx !== -1) {
        reportSheet.getRange(2, weightColIdx + 1, outputRows.length, 1).setNumberFormat("0.000");
    }
    
    try { reportSheet.autoResizeColumns(1, headers.length); } catch (e) { Logger.log(`Warning: autoResizeColumns failed. Error: ${e.message}`); }
    Logger.log(`Raw scores report (V2 Parser) generated in sheet "${reportSheetName}". ${outputRows.length} data rows written.`);
    Logger.log("SUCCESS: Raw scores data (V2 Parser) report generated successfully.");
  } else {
    reportSheet.getRange(2,1).setValue("No response data to display (V2 Parser).");
    Logger.log("No data rows to write to raw scores report (V2 Parser).");
  }
  ss.setActiveSheet(reportSheet);
  Logger.log("--- Raw Scores Report (V2 Parser) Generation Complete ---");
}

/**
 * Identifies students who may not have completed all required evaluations for their peers
 * within their assigned production unit(s). It compares the expected peer evaluations against
 * actual submissions recorded. The results are outputted to the 'PaReportMissingAssessments' sheet.
 * This function is invoked from the custom menu.
 * - USES THE V2 PARSER.
 *
 * @function findStudentsWhoHaventAssessedSpecificPeers
 */
// eslint-disable-next-line no-unused-vars
function findStudentsWhoHaventAssessedSpecificPeers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear(); 
  Logger.log("--- findStudentsWhoHaventAssessedSpecificPeers: Starting (camelCase Headers, V2 Parser) ---");

  const reportSheetName = PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME;

  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses) {
    const errorMsg = "ERROR: V2 Parser did not return expected data (students/responses) for missing assessment check.";
    Logger.log(errorMsg);
    throw new Error("Could not parse necessary data using V2 parser. Cannot find missing assessments.");
  }
  const { students: allStudentsMaster, responses } = parsedData;

  if (Object.keys(allStudentsMaster).length === 0) { 
    const errorMsg = "ERROR: No students parsed by V2 parser for missing assessment check.";
    Logger.log(errorMsg);
    throw new Error("No valid student data parsed (V2 Parser). Cannot find missing assessments.");
  }
  Logger.log(`findStudentsWhoHaventAssessedSpecificPeers: Using ${Object.keys(allStudentsMaster).length} students from V2 parsed data.`);

  const studentsByUnit = {};
  for (const studentId in allStudentsMaster) {
    if (Object.prototype.hasOwnProperty.call(allStudentsMaster, studentId)) {
        const student = allStudentsMaster[studentId]; 
        if (student && student.productionUnit1 && isValidProductionUnit(student.productionUnit1)) {
          if (!studentsByUnit[student.productionUnit1]) studentsByUnit[student.productionUnit1] = []; 
          studentsByUnit[student.productionUnit1].push(student.studentId); 
        }
        if (student && student.productionUnit2 && isValidProductionUnit(student.productionUnit2)) {
          if (!studentsByUnit[student.productionUnit2]) studentsByUnit[student.productionUnit2] = [];
          if (!studentsByUnit[student.productionUnit2].includes(student.studentId)) { 
              studentsByUnit[student.productionUnit2].push(student.studentId);
          }
        }
    }
  }
  Logger.log("findStudentsWhoHaventAssessedSpecificPeers: studentsByUnit populated.");

  const assessmentsMade = {};
  responses.forEach(response => {
    if (response.responseByStudentId && response.evaluatedStudentId) {
        const evaluatorId = response.responseByStudentId;
        const evaluatedId = response.evaluatedStudentId;
        const evaluatorDetails = allStudentsMaster[evaluatorId]; 
        
        let unitOfEvaluation = null;
        if (response.unitContextOfEvaluation && isValidProductionUnit(response.unitContextOfEvaluation)) {
            unitOfEvaluation = response.unitContextOfEvaluation;
        } else if (evaluatorDetails && evaluatorDetails.productionUnit1 && isValidProductionUnit(evaluatorDetails.productionUnit1)) {
            unitOfEvaluation = evaluatorDetails.productionUnit1;
        } else {
            return; 
        }
        
        if (!assessmentsMade[evaluatorId]) assessmentsMade[evaluatorId] = {};
        if (!assessmentsMade[evaluatorId][unitOfEvaluation]) assessmentsMade[evaluatorId][unitOfEvaluation] = new Set();
        assessmentsMade[evaluatorId][unitOfEvaluation].add(evaluatedId);
    }
  });
  Logger.log("findStudentsWhoHaventAssessedSpecificPeers: assessmentsMade structure built.");
  
  let reportSheet = ss.getSheetByName(reportSheetName);
  if (reportSheet) {
    Logger.log(`Sheet "${reportSheetName}" found. Clearing all contents and formats.`);
    reportSheet.clearContents().clearFormats();
  } else {
    reportSheet = ss.insertSheet(reportSheetName);
    Logger.log(`Sheet "${reportSheetName}" created.`);
  }

  const reportHeaders = [
    "evaluatorId", "evaluatorName", "evaluatorEmail", 
    "evaluatorUnitContext", "peerNotAssessedId", "peerNotAssessedName"
  ];
  
  reportSheet.getRange(1, 1, 1, reportHeaders.length).setValues([reportHeaders]);
  reportSheet.getRange(1, 1, 1, reportHeaders.length).setFontWeight("bold").setHorizontalAlignment("center");
  reportSheet.setFrozenRows(1);
  Logger.log(`Populated camelCase headers in "${reportSheetName}".`);

  let reportDataRows = [];
  let foundAnyMissing = false;

  for (const evaluatorId in allStudentsMaster) { 
    if (Object.prototype.hasOwnProperty.call(allStudentsMaster, evaluatorId) && !evaluatorId.startsWith("UNKNOWNID_")) {
        const evaluator = allStudentsMaster[evaluatorId]; 
        
        const unitsEvaluatorBelongsTo = [];
        if (evaluator.productionUnit1 && isValidProductionUnit(evaluator.productionUnit1)) {
            unitsEvaluatorBelongsTo.push(evaluator.productionUnit1);
        }
        if (evaluator.productionUnit2 && isValidProductionUnit(evaluator.productionUnit2) && !unitsEvaluatorBelongsTo.includes(evaluator.productionUnit2)) {
            unitsEvaluatorBelongsTo.push(evaluator.productionUnit2);
        }

        if (unitsEvaluatorBelongsTo.length === 0) {
          continue;
        }

        for (const unitKey of unitsEvaluatorBelongsTo) { 
            const peersInThisUnit = studentsByUnit[unitKey] || []; 
            
            const assessedPeersInThisUnitByThisEvaluator = (assessmentsMade[evaluatorId] && assessmentsMade[evaluatorId][unitKey]) 
                                                          ? assessmentsMade[evaluatorId][unitKey] 
                                                          : new Set(); 
            
            if (peersInThisUnit.length === 0 || (peersInThisUnit.length === 1 && peersInThisUnit[0] === evaluatorId)) {
                continue;
            }

            for (const peerId of peersInThisUnit) { 
              if (peerId === evaluatorId) continue; 

              if (!assessedPeersInThisUnitByThisEvaluator.has(peerId)) {
                foundAnyMissing = true;
                const peerDetails = allStudentsMaster[peerId] || { studentName: `[Unknown Peer ID: ${peerId}]`, studentId: peerId }; 
                reportDataRows.push([ 
                    evaluator.studentId, 
                    evaluator.studentName, 
                    evaluator.studentEmail, 
                    unitKey, 
                    peerDetails.studentId, 
                    peerDetails.studentName 
                ]);
              }
            }
        }
    }
  }

  if (foundAnyMissing && reportDataRows.length > 0) {
    reportDataRows.sort((a, b) => {
        return (a[0].localeCompare(b[0])) || (a[3].localeCompare(b[3])) || (a[4].localeCompare(b[4]));
    });
    reportSheet.getRange(2, 1, reportDataRows.length, reportHeaders.length).setValues(reportDataRows)
               .setVerticalAlignment("middle").setHorizontalAlignment("left");
    
    const centerAlignReportHeaders = ["evaluatorId", "evaluatorUnitContext", "peerNotAssessedId"];
    centerAlignReportHeaders.forEach(headerName => {
        const colIdx = reportHeaders.indexOf(headerName);
        if (colIdx !== -1) {
            reportSheet.getRange(2, colIdx + 1, reportDataRows.length, 1).setHorizontalAlignment("center");
        }
    });
    try { reportSheet.autoResizeColumns(1, reportHeaders.length); } catch (e) { Logger.log(`Warning: autoResizeColumns failed. Error: ${e.message}`); }
    Logger.log("SUCCESS: Detailed missing assessments report (V2 Parser) generated successfully.");
  } else {
    reportSheet.getRange(2,1).setValue("All students appear to have assessed all their required peers based on their assigned unit(s) and available responses (V2 Parser).");
    Logger.log("INFO: No missing assessments found (V2 Parser).");
  }
  ss.setActiveSheet(reportSheet);
  Logger.log("--- Detailed Missing Assessments Generation Complete (V2 Parser) ---");
}

/**
 * Verifies the accuracy of the 'Detailed Missing Assessments' report by re-analyzing
 * the current raw assessment data. It compares entries in the generated report against
 * what is currently derivable from the data. Discrepancies are noted in a summary sheet
 * ('PaVerificationMissingAssessments'). This function is invoked from the custom menu.
 * - USES THE V2 PARSER.
 *
 * @function verifyMissingAssessmentsReport
 */
// eslint-disable-next-line no-unused-vars
function verifyMissingAssessmentsReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- Starting Verification of Missing Assessments Report (camelCase Headers, V2 Parser) ---");

  const generatedReportSheetName = PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME;
  const verificationSummarySheetName = PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME;

  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses) {
    const errorMsg = "ERROR: V2 Parser did not return expected data for verification.";
    Logger.log(errorMsg);
    throw new Error("Could not parse data (V2 Parser). Cannot verify missing assessments report.");
  }
  const { students: allStudentsMaster, responses } = parsedData;
  if (Object.keys(allStudentsMaster).length === 0) {
    const errorMsg = "ERROR: No students from V2 Parser for verification.";
    Logger.log(errorMsg);
    throw new Error("No student data parsed (V2 Parser). Cannot verify.");
  }
  Logger.log("Verification: Using V2 parsed data for current assessment state.");

  const assessmentsMade = {};
  responses.forEach(response => {
    if (response.responseByStudentId && response.evaluatedStudentId) {
        const evaluatorId = response.responseByStudentId;
        const evaluatedId = response.evaluatedStudentId;
        const evaluatorDetails = allStudentsMaster[evaluatorId];
        
        let unitOfEvaluation = null;
        if (response.unitContextOfEvaluation && isValidProductionUnit(response.unitContextOfEvaluation)) {
            unitOfEvaluation = response.unitContextOfEvaluation;
        } else if (evaluatorDetails && evaluatorDetails.productionUnit1 && isValidProductionUnit(evaluatorDetails.productionUnit1)) {
            unitOfEvaluation = evaluatorDetails.productionUnit1;
        } else {
            return; 
        }
        
        if (!assessmentsMade[evaluatorId]) assessmentsMade[evaluatorId] = {};
        if (!assessmentsMade[evaluatorId][unitOfEvaluation]) assessmentsMade[evaluatorId][unitOfEvaluation] = new Set();
        assessmentsMade[evaluatorId][unitOfEvaluation].add(evaluatedId);
    }
  });
  Logger.log("Verification: Re-built assessmentsMade structure from V2 data.");

  let generatedReportSheet = ss.getSheetByName(generatedReportSheetName);
  if (!generatedReportSheet) {
    const errorMsg = `ERROR: Report sheet "${generatedReportSheetName}" not found for verification.`;
    Logger.log(errorMsg);
    throw new Error(`The report sheet "${generatedReportSheetName}" to verify was not found. Please generate it first.`);
  }
  const reportContent = generatedReportSheet.getDataRange().getValues();
  if (reportContent.length < 1) { 
    const errorMsg = `INFO: Report sheet "${generatedReportSheetName}" is empty. Nothing to verify.`;
    Logger.log(errorMsg);
    throw new Error(`The report sheet "${generatedReportSheetName}" is empty or has no headers. Nothing to verify.`);
  }
  
  const reportActualHeaders = reportContent[0].map(h => h ? h.toString().trim() : "");
  const repEvalIdColIdx = reportActualHeaders.indexOf("evaluatorId");
  const repEvalUnitColIdx = reportActualHeaders.indexOf("evaluatorUnitContext"); 
  const repPeerNotAssessedIdColIdx = reportActualHeaders.indexOf("peerNotAssessedId");

  if (repEvalIdColIdx === -1 || repEvalUnitColIdx === -1 || repPeerNotAssessedIdColIdx === -1) {
      const missingHeaders = [
          (repEvalIdColIdx === -1 ? "evaluatorId" : null),
          (repEvalUnitColIdx === -1 ? "evaluatorUnitContext" : null),
          (repPeerNotAssessedIdColIdx === -1 ? "peerNotAssessedId" : null)
      ].filter(Boolean).join(", ");
      const errorMsg = `ERROR: Missing critical headers in report sheet "${generatedReportSheetName}". Needed: evaluatorId, evaluatorUnitContext, peerNotAssessedId.`;
      Logger.log(errorMsg);
      throw new Error(`One or more expected camelCase headers (${missingHeaders}) not found in "${generatedReportSheetName}". Cannot verify. Found: ${reportActualHeaders.join(', ')}`);
  }

  let verificationResults = []; 
  let discrepanciesFound = 0;
  let correctlyMissingOrNA = 0;
  let totalCheckedInReport = 0;

  for (let i = 1; i < reportContent.length; i++) { 
    const reportRow = reportContent[i];
    if (!reportRow || reportRow.every(cell => (cell === null || cell === undefined || cell.toString().trim() === ""))) continue; 

    const reportedEvaluatorId = reportRow[repEvalIdColIdx] ? reportRow[repEvalIdColIdx].toString().trim() : null;
    const reportedEvaluatorUnit = reportRow[repEvalUnitColIdx] ? reportRow[repEvalUnitColIdx].toString().trim().toUpperCase() : null;
    const reportedPeerNotAssessedId = reportRow[repPeerNotAssessedIdColIdx] ? reportRow[repPeerNotAssessedIdColIdx].toString().trim() : null;

    if (i === 1 && reportRow[0] && typeof reportRow[0] === 'string' && reportRow[0].toLowerCase().includes("all students appear to have assessed")) {
        Logger.log("Verification: Report sheet indicates 'All students assessed'. No specific entries to check.");
        break; 
    }
    
    if (!reportedEvaluatorId || !reportedEvaluatorUnit || !reportedPeerNotAssessedId) {
      Logger.log(`Verification: Skipping malformed data row ${i+1} in report: ${reportRow.join(', ')} (Missing ID, Unit, or PeerID).`);
      continue;
    }
    if (reportedPeerNotAssessedId.toUpperCase() === "N/A" || reportedPeerNotAssessedId.toUpperCase() === "N/A (CHECK SETUP)") {
        totalCheckedInReport++; 
        correctlyMissingOrNA++; 
        continue;
    }

    totalCheckedInReport++;
    let actuallyAssessed = false;
    if (assessmentsMade[reportedEvaluatorId] && 
        assessmentsMade[reportedEvaluatorId][reportedEvaluatorUnit] &&
        assessmentsMade[reportedEvaluatorId][reportedEvaluatorUnit].has(reportedPeerNotAssessedId)) {
      actuallyAssessed = true;
    }

    if (actuallyAssessed) {
      discrepanciesFound++;
      const evaluatorDetails = allStudentsMaster[reportedEvaluatorId] || { studentName: `[Unknown: ${reportedEvaluatorId}]` };
      const peerDetails = allStudentsMaster[reportedPeerNotAssessedId] || { studentName: `[Unknown: ${reportedPeerNotAssessedId}]` };
      verificationResults.push([
        reportedEvaluatorId, 
        evaluatorDetails.studentName,
        reportedEvaluatorUnit,
        reportedPeerNotAssessedId,
        peerDetails.studentName,
        "ERROR: Reported as MISSING, but current data shows assessment WAS MADE."
      ]);
    } else {
      correctlyMissingOrNA++;
    }
  }

  let summarySheet = ss.getSheetByName(verificationSummarySheetName);
  if (summarySheet) { 
    summarySheet.clearContents().clearFormats(); 
    Logger.log(`Sheet "${verificationSummarySheetName}" found and cleared.`);
  } else { 
    summarySheet = ss.insertSheet(verificationSummarySheetName); 
    Logger.log(`Sheet "${verificationSummarySheetName}" created.`);
  }

  summarySheet.appendRow(["Verification Summary for 'Detailed Missing Assessments' Report (based on V2 Parser data)"]);
  summarySheet.getRange("A1").setFontWeight("bold");
  summarySheet.appendRow([""]); 
  summarySheet.appendRow(["Total Entries Checked in Report:", totalCheckedInReport]);
  summarySheet.appendRow(["Entries Correctly Listed as Missing (or N/A in report):", correctlyMissingOrNA]);
  summarySheet.appendRow(["Discrepancies (Reported Missing, but Found in current V2 data):", discrepanciesFound]);
  summarySheet.appendRow([""]); 

  if (discrepanciesFound > 0) {
    summarySheet.appendRow(["--- Discrepancies Found ---"]);
    summarySheet.getRange(summarySheet.getLastRow(), 1).setFontWeight("bold");
    const discrepancyHeaders = [ 
        "reportedEvaluatorId", "evaluatorName", "reportedUnitContext", 
        "reportedPeerNotAssessedId", "peerName", "verificationStatus"
    ];
    summarySheet.appendRow(discrepancyHeaders);
    summarySheet.getRange(summarySheet.getLastRow(), 1, 1, discrepancyHeaders.length).setFontWeight("bold").setHorizontalAlignment("center");
    if (verificationResults.length > 0) {
        summarySheet.getRange(summarySheet.getLastRow() + 1, 1, verificationResults.length, verificationResults[0].length)
                   .setValues(verificationResults)
                   .setVerticalAlignment("middle").setHorizontalAlignment("left");
        
        const centerAlignSummaryHeaders = ["reportedEvaluatorId", "reportedUnitContext", "reportedPeerNotAssessedId"];
        centerAlignSummaryHeaders.forEach(headerName => {
            const colIdx = discrepancyHeaders.indexOf(headerName);
            if (colIdx !== -1) {
                summarySheet.getRange(summarySheet.getLastRow() - verificationResults.length + 1, colIdx + 1, verificationResults.length, 1).setHorizontalAlignment("center");
            }
        });
        try { summarySheet.autoResizeColumns(1, discrepancyHeaders.length); } catch (e) { Logger.log(`Warning: autoResizeColumns for discrepancies failed. ${e.message}`);}
    }
  } else if (totalCheckedInReport > 0 || (reportContent.length >= 2 && typeof reportContent[1][0] === 'string' && reportContent[1][0].toLowerCase().includes("all students appear"))) {
    summarySheet.appendRow(["No discrepancies found. The 'Detailed Missing Assessments' report appears consistent with current V2 data."]);
  } else if (reportContent.length <=1 && totalCheckedInReport === 0) { 
     summarySheet.appendRow(["The 'Detailed Missing Assessments' report was empty (or only had headers), and no entries were checked."]);
  } else {
    summarySheet.appendRow(["No specific missing assessment entries were found in the source report to verify, or no discrepancies noted (V2 Parser context)."]);
  }
  
  Logger.log(`Verification Complete. Summary written to "${verificationSummarySheetName}". Discrepancies: ${discrepanciesFound}.`);
  Logger.log(`SUCCESS: Verification complete. Summary written to sheet: "${verificationSummarySheetName}". Discrepancies found: ${discrepanciesFound}. (V2 Parser context)`);
  ss.setActiveSheet(summarySheet);
  Logger.log("--- Verification of Missing Assessments Report Complete (V2 Parser) ---");
}