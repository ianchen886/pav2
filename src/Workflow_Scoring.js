/* global PA_FINAL_SCORES_SUMMARY_SHEET_NAME, parseRawSurveyData, generateEvaluatorAnalyticsAndWeights, calculateMean, calculateMedianFromArray */

/**
 * @file Workflow_Scoring.js
 * @description This file is responsible for calculating the final weighted peer assessment scores
 * for each student and for each question, as well as an overall weighted median score per student.
 * It utilizes parsed submission data and evaluator weights. The results are outputted to the
 * 'PaFinalScoresSummary' Google Sheet. This function is typically invoked from the
 * custom menu in Google Sheets.
 *
 * @requires Config.gs (for PA_FINAL_SCORES_SUMMARY_SHEET_NAME)
 * @requires Parser_V2.js (for parseRawSurveyData function)
 * @requires Workflow_Analytics.js (for generateEvaluatorAnalyticsAndWeights function)
 * @requires Utils.js (for calculateMean, calculateMedianFromArray functions)
 */

// In Workflow_Scoring.gs // Your existing comment

/**
 * Calculates weighted peer assessment scores for each student and updates the
 * 'PaFinalScoresSummary' sheet.
 *
 * The process involves:
 * 1. Parsing raw submission data using {@link parseRawSurveyData}.
 * 2. Generating/retrieving evaluator weights using {@link generateEvaluatorAnalyticsAndWeights}.
 * 3. Preparing the target summary sheet ('PaFinalScoresSummary') by clearing it and setting up headers.
 * 4. Populating the sheet with a list of active students from the master list.
 * 5. For each student and each assessment question:
 *    a. Aggregating all scores received for that student on that question.
 *    b. Applying the respective evaluator's weight to each score.
 *    c. Calculating a weighted average score for the question.
 *    d. If no weighted scores are available but unweighted scores exist, a simple mean is used as a fallback.
 * 6. Calculating an overall weighted median score for each student across all their question scores.
 * 7. Writing these calculated scores and medians to the 'PaFinalScoresSummary' sheet.
 *
 * This function is typically called from a custom menu item.
 *
 * @function calculateWeightedScoresAndUpdateSheet
 * @returns {void} This function does not return a value but updates a Google Sheet.
 */
// eslint-disable-next-line no-unused-vars
function calculateWeightedScoresAndUpdateSheet() {
  const ui = SpreadsheetApp.getUi(); // GAS services from eslint.config.mjs
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- calculateWeightedScoresAndUpdateSheet: Starting (Using V2 Parser, camelCase Headers) ---");

  const targetSheetName = PA_FINAL_SCORES_SUMMARY_SHEET_NAME; 

  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses || !parsedData.questions) {
    ui.alert("Data Parsing Error", "Could not parse data using V2 parser. Cannot calculate scores.", ui.ButtonSet.OK);
    Logger.log("ERROR: V2 Parsed data is invalid or incomplete (students, questions, or responses missing).");
    return;
  }
  const { students: allStudentsFromMaster, questions, responses } = parsedData; 
  if (Object.keys(allStudentsFromMaster).length === 0 || Object.keys(questions).length === 0) {
    ui.alert("Data Parsing Info", "No active students or no questions parsed. Cannot calculate scores.", ui.ButtonSet.OK);
    Logger.log(`INFO: No active students (${Object.keys(allStudentsFromMaster).length}) or no questions (${Object.keys(questions).length}) parsed. Aborting score calculation.`);
    return;
  }
  Logger.log(`V2 Parsed data: ${Object.keys(allStudentsFromMaster).length} active students, ${Object.keys(questions).length} questions, ${responses.length} responses.`);

  const evaluatorWeights = generateEvaluatorAnalyticsAndWeights(); 
  if (!evaluatorWeights) { 
    ui.alert("Weighting Error", "Critical error: Could not retrieve evaluator weights (function returned null). Scores cannot be calculated.", ui.ButtonSet.OK);
    Logger.log("CRITICAL ERROR: Evaluator weights function (generateEvaluatorAnalyticsAndWeights) returned null. Aborting score calculation.");
    return; 
  } else if (Object.keys(evaluatorWeights).length === 0) {
    Logger.log("Warning: Evaluator weights object is empty. All scores will effectively be unweighted or based on fallback logic if no evaluators had sufficient data for weighting.");
  } else {
    Logger.log(`Retrieved ${Object.keys(evaluatorWeights).length} evaluator weights.`);
  }

  let targetSheet = ss.getSheetByName(targetSheetName); // Changed: var to let
  if (targetSheet) {
    Logger.log(`Sheet "${targetSheetName}" found. Clearing contents and formats.`);
    targetSheet.clearContents().clearFormats(); 
  } else {
    targetSheet = ss.insertSheet(targetSheetName);
    Logger.log(`Sheet "${targetSheetName}" created.`);
  }
  
  const studentIdHeader = "studentId";
  const studentNameHeader = "studentName";
  const overallMedianHeader = "overallWeightedMedian";
  
  const expectedHeadersInOrder = [studentIdHeader, studentNameHeader]; // Changed: var to const
  const sortedQuestionIds = Object.keys(questions).sort(); 
  sortedQuestionIds.forEach(qId => expectedHeadersInOrder.push(qId.toLowerCase())); 
  expectedHeadersInOrder.push(overallMedianHeader);

  Logger.log(`Populating canonical camelCase headers in "${targetSheetName}". Headers: ${expectedHeadersInOrder.join(', ')}`);
  targetSheet.getRange(1, 1, 1, expectedHeadersInOrder.length).setValues([expectedHeadersInOrder]);
  targetSheet.getRange(1, 1, 1, expectedHeadersInOrder.length).setFontWeight("bold").setHorizontalAlignment("center");
  targetSheet.setFrozenRows(1);
    
  const headerMap = {};
  expectedHeadersInOrder.forEach((header, index) => { headerMap[header] = index; });
  const studentIdColTargetIdx = headerMap[studentIdHeader]; 
  const studentNameColTargetIdx = headerMap[studentNameHeader]; 
  
  const questionColMapTarget = {}; // Changed: var to const
  let overallMedianColNum = -1;  // Changed: var to let

  expectedHeadersInOrder.forEach((header, index) => {
      if (header.match(/^q\d{1,2}$/)) { 
          questionColMapTarget[header.toUpperCase()] = index + 1; 
      } else if (header === overallMedianHeader) {
          overallMedianColNum = index + 1;
      }
  });

  if (Object.keys(questionColMapTarget).length !== sortedQuestionIds.length) {
      Logger.log(`CRITICAL ERROR: Question column mapping failed for target sheet "${targetSheetName}". Expected ${sortedQuestionIds.length} question columns, mapped ${Object.keys(questionColMapTarget).length}.`);
      ui.alert("Internal Error", "Failed to map question columns in target sheet. Check logs.", ui.ButtonSet.OK);
      return; 
  }
  if (expectedHeadersInOrder.includes(overallMedianHeader) && overallMedianColNum === -1) {
     Logger.log(`CRITICAL ERROR: Overall median column mapping failed for target sheet "${targetSheetName}".`);
     ui.alert("Internal Error", "Failed to map overall median column in target sheet. Check logs.", ui.ButtonSet.OK);
     return;
  }

  const studentsToAddRows = []; // Changed: var to const
  const studentIdsFromMasterSorted = Object.keys(allStudentsFromMaster).sort((a,b) => {
    const studentA = allStudentsFromMaster[a];
    const studentB = allStudentsFromMaster[b];
    if (studentA && studentA.studentName && studentB && studentB.studentName) {
        return studentA.studentName.localeCompare(studentB.studentName);
    }
    return a.localeCompare(b); 
  });

  for (const studentId of studentIdsFromMasterSorted) { 
      const studentDetails = allStudentsFromMaster[studentId];
      if (studentDetails && studentDetails.studentId) { 
          let studentRowValues = new Array(expectedHeadersInOrder.length).fill(""); 
          studentRowValues[studentIdColTargetIdx] = studentDetails.studentId; 
          if (studentNameColTargetIdx !== undefined) { 
             studentRowValues[studentNameColTargetIdx] = studentDetails.studentName || `[Name missing for ${studentDetails.studentId}]`; 
          }
          studentsToAddRows.push(studentRowValues);
      }
  }
  if (studentsToAddRows.length > 0) {
      targetSheet.getRange(2, 1, studentsToAddRows.length, studentsToAddRows[0].length).setValues(studentsToAddRows);
      Logger.log(`Populated ${studentsToAddRows.length} active students into "${targetSheetName}".`);
  } else {
      Logger.log(`No active students from master list to populate into "${targetSheetName}".`);
      return;
  }
  
  const finalTargetSheetData = targetSheet.getDataRange().getValues(); // Changed: var to const
  
  const updatesForSheet = []; // Changed: var to const
  
  for (let r = 1; r < finalTargetSheetData.length; r++) { 
    const evaluatedStudentId = finalTargetSheetData[r][studentIdColTargetIdx] ? finalTargetSheetData[r][studentIdColTargetIdx].toString().trim() : null;
    
    if (!evaluatedStudentId || !allStudentsFromMaster[evaluatedStudentId]) { 
        Logger.log(`Skipping sheet row ${r+1} (data array index ${r}), student ID '${finalTargetSheetData[r][studentIdColTargetIdx]}' not in active master list or is null.`);
        continue;
    }

    let studentQuestionScoresForMedian = []; 
    
    for (const questionId of sortedQuestionIds) { 
      const targetSheetQuestionColNum = questionColMapTarget[questionId]; 
      
      if (!targetSheetQuestionColNum) {
        Logger.log(`Warning: Column for question ${questionId} (header: ${questionId.toLowerCase()}) not found in target sheet map for student ${evaluatedStudentId}. Skipping this question for this student.`);
        continue;
      }
      
      let weightedScoreSum = 0;
      let totalWeightSum = 0;
      let scoresForThisItemCount = 0; 
      let unweightedScores = [];     

      responses.forEach(resp => {
        if (resp.evaluatedStudentId === evaluatedStudentId &&
            resp.responseToQuestionId === questionId && 
            resp.responseType === "SCORE" && typeof resp.responseValue === 'number' && !isNaN(resp.responseValue)) {
          
          unweightedScores.push(resp.responseValue);
          const evaluatorId = resp.responseByStudentId;
          
          let evaluatorWeight = 0;
          if (evaluatorId && evaluatorWeights && Object.prototype.hasOwnProperty.call(evaluatorWeights, evaluatorId)) { // Check own property
              const w = evaluatorWeights[evaluatorId];
              if (typeof w === 'number' && !isNaN(w)) {
                  evaluatorWeight = w;
              } else {
                  Logger.log(`Note: Evaluator ${evaluatorId} has a non-numeric or NaN weight (${w}). Treating as 0 for this calculation.`);
              }
          }
          
          if (evaluatorWeight > 0) { 
            weightedScoreSum += resp.responseValue * evaluatorWeight;
            totalWeightSum += evaluatorWeight;
            scoresForThisItemCount++;
          }
        }
      });

      let finalScoreForQuestion = ""; 
      if (scoresForThisItemCount > 0 && totalWeightSum > 0) {
        finalScoreForQuestion = weightedScoreSum / totalWeightSum;
      } else if (unweightedScores.length > 0) { 
        Logger.log(`Info: Zero total weight for ${evaluatedStudentId} on ${questionId}. Using MEAN of ${unweightedScores.length} unweighted scores as fallback.`);
        finalScoreForQuestion = calculateMean(unweightedScores); 
      }
      
      if (typeof finalScoreForQuestion === 'number' && !isNaN(finalScoreForQuestion)) {
        studentQuestionScoresForMedian.push(finalScoreForQuestion); 
        updatesForSheet.push({ 
            row: r + 1, 
            col: targetSheetQuestionColNum, 
            value: parseFloat(finalScoreForQuestion.toFixed(2))
        });
      } else {
         updatesForSheet.push({ 
            row: r + 1, 
            col: targetSheetQuestionColNum, 
            value: ""
        });
      }
    } 

    if (studentQuestionScoresForMedian.length > 0 && overallMedianColNum > 0) {
        let overallMedianValue = calculateMedianFromArray(studentQuestionScoresForMedian); 
        if (typeof overallMedianValue === 'number' && !isNaN(overallMedianValue)) {
            updatesForSheet.push({
                row: r + 1, 
                col: overallMedianColNum,
                value: parseFloat(overallMedianValue.toFixed(2))
            });
        } else { 
            updatesForSheet.push({ row: r + 1, col: overallMedianColNum, value: "" });
        }
    } else if (overallMedianColNum > 0) { 
        updatesForSheet.push({
            row: r + 1, 
            col: overallMedianColNum,
            value: ""
        });
    }
  } 
  Logger.log("WEIGHTED scores and overall medians calculated for batch update. Total updates to apply: " + updatesForSheet.length);

  if (updatesForSheet.length > 0) {
    updatesForSheet.forEach(update => { 
        if (update.row > 0 && update.col > 0) { 
            targetSheet.getRange(update.row, update.col)
                       .setValue(update.value)
                       .setNumberFormat((update.value === "" || typeof update.value !== 'number' || isNaN(update.value)) ? "@" : "0.00");
        }
    });
    try { 
        targetSheet.autoResizeColumns(1, expectedHeadersInOrder.length);
    } catch (e) {
        Logger.log(`Warning: autoResizeColumns failed. Error: ${e.message}`);
    }
    Logger.log(`Updated score/median cells in "${targetSheetName}".`);
    ui.alert("Weighted Scores Updated", `WEIGHTED scores and overall medians updated in "${targetSheetName}".`, ui.ButtonSet.OK);
  } else {
    Logger.log("No WEIGHTED scores or medians to update in target sheet (updatesForSheet array was empty).");
  }
  ss.setActiveSheet(targetSheet); 
  Logger.log(`--- calculateWeightedScoresAndUpdateSheet: Complete (Using V2 Parser for ${targetSheetName}) ---`);
}