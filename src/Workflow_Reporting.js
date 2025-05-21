// In Workflow_Reporting.gs

/**
 * Generates a report of all raw responses with evaluator weights.
 * - Uses camelCase headers for the report sheet.
 * - Creates/clears the report sheet and populates headers.
 */
function generateRawScoresReportWithWeights() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- Starting Raw Scores Report Generation (camelCase Headers, with Weights, using V2 Parser) ---");

  const reportSheetName = PA_REPORT_ALL_RESPONSES_SHEET_NAME;

  // *** USING V2 PARSER ***
  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses || !parsedData.questions) {
    ui.alert("Data Parsing Error", "Could not parse necessary data using V2 parser. Cannot generate raw scores report.", ui.ButtonSet.OK); 
    Logger.log("ERROR: V2 Parser did not return expected data for raw scores report.");
    return;
  }
  // allStudents map contains { studentId: "...", studentName: "...", studentEmail: "...", ... }
  const { students: allStudents, questions, responses } = parsedData;
  
  const evaluatorWeights = generateEvaluatorAnalyticsAndWeights(); 
  if (!evaluatorWeights) {
      Logger.log("Warning: Evaluator weights not available (function returned null). Weights column will show 'N/A' or default.");
  } else if (Object.keys(evaluatorWeights).length === 0) {
      Logger.log("Info: Evaluator weights object is empty. Weights column will show 'N/A' or default.");
  }


  if (responses.length === 0 && Object.keys(allStudents).length === 0){ 
    ui.alert("No Data", "No students or responses found after V2 parsing. Raw scores report not generated.", ui.ButtonSet.OK); 
    Logger.log("No student or response data available for raw scores report (V2 Parser).");
    return;
  }
  Logger.log(`Generating raw scores report from ${responses.length} responses (V2 Parser).`);

  var reportSheet = ss.getSheetByName(reportSheetName);
  if (reportSheet) {
    Logger.log(`Sheet "${reportSheetName}" found. Clearing all contents and formats.`);
    reportSheet.clearContents().clearFormats();
  } else {
    reportSheet = ss.insertSheet(reportSheetName);
    // ui.alert("Sheet Created", `Report sheet named "${reportSheetName}" was not found and has been created.`, ui.ButtonSet.OK); // Can be noisy
    Logger.log(`Sheet "${reportSheetName}" created.`);
  }

  const headers = [
    "timestamp", "evaluatedStudentId", "evaluatedStudentName", 
    "questionId", "questionPrompt", "responseType", "responseValue", 
    "evaluatorId", "evaluatorName", "evaluatorWeight", "unitContextOfEvaluation" // Added unitContext
  ];
  
  reportSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  reportSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setHorizontalAlignment("center");
  reportSheet.setFrozenRows(1);
  Logger.log(`Populated camelCase headers in "${reportSheetName}".`);

  var outputRows = []; 
  for (const response of responses) {
    // Student objects from V2 parser have .studentName, .studentId etc.
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
      evaluatedStudentInfo.studentName, // Uses .studentName
      response.responseToQuestionId || "",
      questionInfo.questionPrompt, 
      response.responseType || "", 
      response.responseValue,
      response.responseByStudentId || "", 
      evaluatorStudentInfo.studentName, // Uses .studentName
      evaluatorWeightValue,
      response.unitContextOfEvaluation || "" // Added
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
    reportSheet.getRange(2, headers.indexOf("timestamp") + 1, outputRows.length, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    if (headers.indexOf("evaluatorWeight") !== -1) {
        reportSheet.getRange(2, headers.indexOf("evaluatorWeight") + 1, outputRows.length, 1).setNumberFormat("0.000");
    }
    
    try { reportSheet.autoResizeColumns(1, headers.length); } catch (e) { Logger.log(`Warning: autoResizeColumns failed. Error: ${e.message}`); }
    Logger.log(`Raw scores report (V2 Parser) generated in sheet "${reportSheetName}". ${outputRows.length} data rows written.`);
    ui.alert("Report Generated", `Raw scores data (V2 Parser) written to sheet: "${reportSheetName}".`, ui.ButtonSet.OK);
  } else {
    reportSheet.getRange(2,1).setValue("No response data to display (V2 Parser).");
    Logger.log("No data rows to write to raw scores report (V2 Parser).");
    // ui.alert("Info", "No response data was found to populate the raw scores report.", ui.ButtonSet.OK);
  }
  ss.setActiveSheet(reportSheet);
  Logger.log("--- Raw Scores Report (V2 Parser) Generation Complete ---");
}


/**
 * Finds students who haven't assessed all required peers in their primary unit(s).
 * - Uses camelCase headers for the report sheet.
 * - Creates/clears the report sheet and populates headers.
 * - USES THE V2 PARSER.
 */
function findStudentsWhoHaventAssessedSpecificPeers() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear(); 
  Logger.log("--- findStudentsWhoHaventAssessedSpecificPeers: Starting (camelCase Headers, V2 Parser) ---");

  const reportSheetName = PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME;

  // *** USING V2 PARSER ***
  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses) { // Questions not strictly needed here, but good to check
    ui.alert("Data Parsing Error", "Could not parse necessary data using V2 parser. Cannot find missing assessments.", ui.ButtonSet.OK);
    Logger.log("ERROR: V2 Parser did not return expected data (students/responses) for missing assessment check.");
    return;
  }
  // allStudentsMaster contains student objects with .studentId, .studentName, .studentEmail, .productionUnit1, .productionUnit2, .status
  const { students: allStudentsMaster, responses } = parsedData;

  if (Object.keys(allStudentsMaster).length === 0) { 
    ui.alert("Data Error", "No valid student data parsed (V2 Parser). Cannot find missing assessments.", ui.ButtonSet.OK); 
    Logger.log("ERROR: No students parsed by V2 parser for missing assessment check.");
    return; 
  }
  Logger.log(`findStudentsWhoHaventAssessedSpecificPeers: Using ${Object.keys(allStudentsMaster).length} students from V2 parsed data.`);

  var studentsByUnit = { "A": [], "B": [], "C": [], "D": [] }; // Add more units if needed
  for (const studentId in allStudentsMaster) {
    const student = allStudentsMaster[studentId]; // student object has .productionUnit1
    if (student && student.productionUnit1 && isValidProductionUnit(student.productionUnit1)) {
      if (!studentsByUnit[student.productionUnit1]) studentsByUnit[student.productionUnit1] = []; // Initialize if unit not seen
      studentsByUnit[student.productionUnit1].push(student.studentId); // Store ID
    }
    // Consider productionUnit2 if students can belong to and assess in multiple primary units
    if (student && student.productionUnit2 && isValidProductionUnit(student.productionUnit2)) {
      if (!studentsByUnit[student.productionUnit2]) studentsByUnit[student.productionUnit2] = [];
      if (!studentsByUnit[student.productionUnit2].includes(student.studentId)) { // Avoid duplicates if same as unit1
          studentsByUnit[student.productionUnit2].push(student.studentId);
      }
    }
  }
  Logger.log("findStudentsWhoHaventAssessedSpecificPeers: studentsByUnit populated.");

  var assessmentsMade = {}; // Structure: { evaluatorId: { unitKey: Set(evaluatedId1, evaluatedId2), ... }, ... }
  responses.forEach(response => {
    // response object has .responseByStudentId, .evaluatedStudentId, .unitContextOfEvaluation
    if (response.responseByStudentId && response.evaluatedStudentId) {
        const evaluatorId = response.responseByStudentId;
        const evaluatedId = response.evaluatedStudentId;
        const evaluatorDetails = allStudentsMaster[evaluatorId]; // Get full student object

        // Use unitContextOfEvaluation from response if available and valid.
        // Fallback to evaluator's primary unit (productionUnit1) if context is missing or invalid.
        let unitOfEvaluation = null;
        if (response.unitContextOfEvaluation && isValidProductionUnit(response.unitContextOfEvaluation)) {
            unitOfEvaluation = response.unitContextOfEvaluation;
        } else if (evaluatorDetails && evaluatorDetails.productionUnit1 && isValidProductionUnit(evaluatorDetails.productionUnit1)) {
            unitOfEvaluation = evaluatorDetails.productionUnit1;
            // Logger.log(`INFO: No valid unitContext for response by ${evaluatorId} to ${evaluatedId}. Using evaluator's unit1: ${unitOfEvaluation}`);
        } else {
            // Logger.log(`WARNING: Cannot determine unit context for response by ${evaluatorId} to ${evaluatedId}. Skipping this response for missing assessment counts.`);
            return; // Skip if no valid unit context can be determined
        }
        
        if (!assessmentsMade[evaluatorId]) assessmentsMade[evaluatorId] = {};
        if (!assessmentsMade[evaluatorId][unitOfEvaluation]) assessmentsMade[evaluatorId][unitOfEvaluation] = new Set();
        assessmentsMade[evaluatorId][unitOfEvaluation].add(evaluatedId);
    }
  });
  Logger.log("findStudentsWhoHaventAssessedSpecificPeers: assessmentsMade structure built.");
  
  var reportSheet = ss.getSheetByName(reportSheetName);
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
    if (!allStudentsMaster.hasOwnProperty(evaluatorId) || evaluatorId.startsWith("UNKNOWNID_")) continue;

    const evaluator = allStudentsMaster[evaluatorId]; // Full student object
    
    // Determine units this evaluator is expected to assess peers IN.
    // This should correspond to the units they are a member of.
    const unitsEvaluatorBelongsTo = [];
    if (evaluator.productionUnit1 && isValidProductionUnit(evaluator.productionUnit1)) {
        unitsEvaluatorBelongsTo.push(evaluator.productionUnit1);
    }
    if (evaluator.productionUnit2 && isValidProductionUnit(evaluator.productionUnit2) && !unitsEvaluatorBelongsTo.includes(evaluator.productionUnit2)) {
        unitsEvaluatorBelongsTo.push(evaluator.productionUnit2);
    }

    if (unitsEvaluatorBelongsTo.length === 0) {
      // This evaluator has no valid primary units assigned in the master list.
      // They might still have made assessments if unitContext was in response, but we can't determine who they *should* have assessed.
      // Logger.log(`INFO: Evaluator ${evaluator.studentId} (${evaluator.studentName}) has no valid primary unit(s) in master list. Cannot determine expected peers.`);
      // Optionally, list them with a note if you want to flag this.
      // reportDataRows.push([evaluator.studentId, evaluator.studentName, evaluator.studentEmail, "N/A (No Valid Unit in Master)", "N/A (Check Setup)", "N/A"]);
      // foundAnyMissing = true; 
      continue;
    }

    for (const unitKey of unitsEvaluatorBelongsTo) { // unitKey is the unit the evaluator belongs to, e.g., "A"
        const peersInThisUnit = studentsByUnit[unitKey] || []; // IDs of all students in this unit
        
        // Get the set of peers this evaluator *has* assessed *within this specific unit context*.
        const assessedPeersInThisUnitByThisEvaluator = (assessmentsMade[evaluatorId] && assessmentsMade[evaluatorId][unitKey]) 
                                                      ? assessmentsMade[evaluatorId][unitKey] 
                                                      : new Set(); 
        
        if (peersInThisUnit.length === 0 || (peersInThisUnit.length === 1 && peersInThisUnit[0] === evaluatorId)) {
            // If the unit is empty or only contains the evaluator, no peers to assess in this unit.
            continue;
        }

        for (const peerId of peersInThisUnit) { // peerId is a student in the same unit as the evaluator
          if (peerId === evaluatorId) continue; // Don't assess self

          if (!assessedPeersInThisUnitByThisEvaluator.has(peerId)) {
            foundAnyMissing = true;
            const peerDetails = allStudentsMaster[peerId] || { studentName: `[Unknown Peer ID: ${peerId}]`, studentId: peerId }; 
            reportDataRows.push([ 
                evaluator.studentId, 
                evaluator.studentName, 
                evaluator.studentEmail, 
                unitKey, // The unit context in which the peer was expected to be assessed
                peerDetails.studentId, 
                peerDetails.studentName 
            ]);
          }
        }
    }
  }

  if (foundAnyMissing && reportDataRows.length > 0) {
    // Sort by evaluatorId, then unit, then peerNotAssessedId
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
    ui.alert("Report Generated", `Detailed missing assessments report (V2 Parser) generated in sheet: "${reportSheetName}".`, ui.ButtonSet.OK);
  } else {
    reportSheet.getRange(2,1).setValue("All students appear to have assessed all their required peers based on their assigned unit(s) and available responses (V2 Parser).");
    ui.alert("All Clear", "No missing assessments found (V2 Parser).", ui.ButtonSet.OK);
  }
  ss.setActiveSheet(reportSheet);
  Logger.log("--- Detailed Missing Assessments Generation Complete (V2 Parser) ---");
}


/**
 * Verifies the 'Detailed Missing Assessments' report against current data.
 * - Uses camelCase headers for its summary sheet.
 * - Creates/clears the summary sheet and populates headers.
 * - USES THE V2 PARSER.
 */
function verifyMissingAssessmentsReport() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- Starting Verification of Missing Assessments Report (camelCase Headers, V2 Parser) ---");

  const generatedReportSheetName = PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME;
  const verificationSummarySheetName = PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME;

  // *** USING V2 PARSER ***
  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses) {
    ui.alert("Data Parsing Error", "Could not parse data (V2 Parser). Cannot verify missing assessments report.", ui.ButtonSet.OK);
    Logger.log("ERROR: V2 Parser did not return expected data for verification.");
    return;
  }
  const { students: allStudentsMaster, responses } = parsedData;
  if (Object.keys(allStudentsMaster).length === 0) {
    ui.alert("Data Error", "No student data parsed (V2 Parser). Cannot verify.", ui.ButtonSet.OK);
    Logger.log("ERROR: No students from V2 Parser for verification.");
    return;
  }
  Logger.log("Verification: Using V2 parsed data for current assessment state.");

  // Rebuild assessmentsMade based on CURRENT responses from V2 parsedData
  var assessmentsMade = {}; // { evaluatorId: { unitKey: Set(evaluatedId1), ... }, ... }
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

  var generatedReportSheet = ss.getSheetByName(generatedReportSheetName);
  if (!generatedReportSheet) {
    ui.alert("Report Not Found", `The report sheet "${generatedReportSheetName}" to verify was not found.`, ui.ButtonSet.OK);
    Logger.log(`ERROR: Report sheet "${generatedReportSheetName}" not found for verification.`);
    return;
  }
  var reportContent = generatedReportSheet.getDataRange().getValues();
  if (reportContent.length < 1) { // Must have at least headers
    ui.alert("Report Empty", `The report sheet "${generatedReportSheetName}" is empty. Nothing to verify.`, ui.ButtonSet.OK);
    Logger.log(`INFO: Report sheet "${generatedReportSheetName}" is empty. Nothing to verify.`);
    return;
  }
  
  const reportActualHeaders = reportContent[0].map(h => h ? h.toString().trim() : "");
  const repEvalIdColIdx = reportActualHeaders.indexOf("evaluatorId");
  const repEvalUnitColIdx = reportActualHeaders.indexOf("evaluatorUnitContext"); // Matches header from findStudents...
  const repPeerNotAssessedIdColIdx = reportActualHeaders.indexOf("peerNotAssessedId");

  if (repEvalIdColIdx === -1 || repEvalUnitColIdx === -1 || repPeerNotAssessedIdColIdx === -1) {
      const missingHeaders = [
          (repEvalIdColIdx === -1 ? "evaluatorId" : null),
          (repEvalUnitColIdx === -1 ? "evaluatorUnitContext" : null),
          (repPeerNotAssessedIdColIdx === -1 ? "peerNotAssessedId" : null)
      ].filter(Boolean).join(", ");
      ui.alert("Report Format Error", `One or more expected camelCase headers (${missingHeaders}) not found in "${generatedReportSheetName}". Cannot verify. Found: ${reportActualHeaders.join(', ')}`, ui.ButtonSet.OK);
      Logger.log(`ERROR: Missing critical headers in report sheet "${generatedReportSheetName}". Needed: evaluatorId, evaluatorUnitContext, peerNotAssessedId.`);
      return;
  }

  let verificationResults = []; // Stores discrepancy details
  let discrepanciesFound = 0;
  let correctlyMissingOrNA = 0;
  let totalCheckedInReport = 0;

  // Start from row 1 of reportContent (sheet row 2) to skip headers
  for (let i = 1; i < reportContent.length; i++) { 
    const reportRow = reportContent[i];
    if (!reportRow || reportRow.every(cell => cell === "")) continue; // Skip genuinely blank rows

    const reportedEvaluatorId = reportRow[repEvalIdColIdx] ? reportRow[repEvalIdColIdx].toString().trim() : null;
    const reportedEvaluatorUnit = reportRow[repEvalUnitColIdx] ? reportRow[repEvalUnitColIdx].toString().trim().toUpperCase() : null;
    const reportedPeerNotAssessedId = reportRow[repPeerNotAssessedIdColIdx] ? reportRow[repPeerNotAssessedIdColIdx].toString().trim() : null;

    // Handle the "All students appear to have assessed..." message
    if (i === 1 && reportRow[0] && reportRow[0].toString().toLowerCase().includes("all students appear to have assessed")) {
        Logger.log("Verification: Report sheet indicates 'All students assessed'. No specific entries to check.");
        break; 
    }
    
    if (!reportedEvaluatorId || !reportedEvaluatorUnit || !reportedPeerNotAssessedId) {
      Logger.log(`Verification: Skipping malformed data row ${i+1} in report: ${reportRow.join(', ')} (Missing ID, Unit, or PeerID).`);
      continue;
    }
    // Handle cases where the report itself says "N/A" (e.g., student has no unit)
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

  var summarySheet = ss.getSheetByName(verificationSummarySheetName);
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
  } else if (totalCheckedInReport > 0 || (reportContent.length >= 2 && reportContent[1][0] && reportContent[1][0].toString().toLowerCase().includes("all students appear"))) {
    summarySheet.appendRow(["No discrepancies found. The 'Detailed Missing Assessments' report appears consistent with current V2 data."]);
  } else if (reportContent.length <=1) { // Only headers or empty
     summarySheet.appendRow(["The 'Detailed Missing Assessments' report was empty (or only had headers). Nothing specific to verify."]);
  } else {
    summarySheet.appendRow(["No specific missing assessment entries were found in the source report to verify (V2 Parser context)."]);
  }
  
  Logger.log(`Verification Complete. Summary written to "${verificationSummarySheetName}". Discrepancies: ${discrepanciesFound}.`);
  ui.alert("Verification Complete", `Summary written to sheet: "${verificationSummarySheetName}". Discrepancies found: ${discrepanciesFound}. (V2 Parser context)`, ui.ButtonSet.OK);
  ss.setActiveSheet(summarySheet);
  Logger.log("--- Verification of Missing Assessments Report Complete (V2 Parser) ---");
}