// In Workflow_Scoring.gs

/**
 * Calculates weighted peer scores and updates the target summary sheet ("PaFinalScoresSummary").
 * - Uses the NEW V2 parser (parseRawSurveyData from Parser_V2.gs).
 * - Creates/clears the target sheet and populates with camelCase headers.
 * - Populates student list from the master list of active students.
 * - Clears old scores from the target sheet.
 * - Calculates weighted scores for each question and an overall weighted median for each student.
 * - Writes results to the target summary sheet.
 */
function calculateWeightedScoresAndUpdateSheet() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- calculateWeightedScoresAndUpdateSheet: Starting (Using V2 Parser, camelCase Headers) ---");

  const targetSheetName = PA_FINAL_SCORES_SUMMARY_SHEET_NAME; 

  const parsedData = parseRawSurveyData(); // From Parser_V2.gs
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

  const evaluatorWeights = generateEvaluatorAnalyticsAndWeights(); // From Workflow_Analytics.gs
  if (!evaluatorWeights) { 
    // This means generateEvaluatorAnalyticsAndWeights itself had a critical error and returned null
    ui.alert("Weighting Error", "Critical error: Could not retrieve evaluator weights (function returned null). Scores cannot be calculated.", ui.ButtonSet.OK);
    Logger.log("CRITICAL ERROR: Evaluator weights function (generateEvaluatorAnalyticsAndWeights) returned null. Aborting score calculation.");
    return; 
  } else if (Object.keys(evaluatorWeights).length === 0) {
    Logger.log("Warning: Evaluator weights object is empty. All scores will effectively be unweighted or based on fallback logic if no evaluators had sufficient data for weighting.");
    // ui.alert("Weighting Info", "Evaluator weights object is empty. Scores will be unweighted or use fallback logic.", ui.ButtonSet.OK); // Optional: can be noisy
  } else {
    Logger.log(`Retrieved ${Object.keys(evaluatorWeights).length} evaluator weights.`);
  }

  var targetSheet = ss.getSheetByName(targetSheetName);
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
  
  var expectedHeadersInOrder = [studentIdHeader, studentNameHeader];
  // Sort question IDs to ensure consistent column order
  const sortedQuestionIds = Object.keys(questions).sort(); 
  sortedQuestionIds.forEach(qId => expectedHeadersInOrder.push(qId.toLowerCase())); // q01, q02 etc.
  expectedHeadersInOrder.push(overallMedianHeader);

  Logger.log(`Populating canonical camelCase headers in "${targetSheetName}". Headers: ${expectedHeadersInOrder.join(', ')}`);
  targetSheet.getRange(1, 1, 1, expectedHeadersInOrder.length).setValues([expectedHeadersInOrder]);
  targetSheet.getRange(1, 1, 1, expectedHeadersInOrder.length).setFontWeight("bold").setHorizontalAlignment("center");
  targetSheet.setFrozenRows(1);
    
  // Create a map for 0-based header indices for array access
  const headerMap = {};
  expectedHeadersInOrder.forEach((header, index) => { headerMap[header] = index; });
  const studentIdColTargetIdx = headerMap[studentIdHeader]; 
  const studentNameColTargetIdx = headerMap[studentNameHeader]; 
  
  // Create a map for 1-based column numbers for sheet.getRange() access for questions
  var questionColMapTarget = {}; // Stores QID (UPPERCASE) -> column number (1-based)
  var overallMedianColNum = -1;  // 1-based column number

  expectedHeadersInOrder.forEach((header, index) => {
      if (header.match(/^q\d{1,2}$/)) { // Matches q1, q01, q10 etc.
          questionColMapTarget[header.toUpperCase()] = index + 1; 
      } else if (header === overallMedianHeader) {
          overallMedianColNum = index + 1;
      }
  });

  // Validate header mapping
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


  // --- Populate Student List in Target Sheet using allStudentsFromMaster ---
  var studentsToAddRows = []; 
  // Sort student IDs by student name for consistent order in the sheet
  const studentIdsFromMasterSorted = Object.keys(allStudentsFromMaster).sort((a,b) => {
    const studentA = allStudentsFromMaster[a];
    const studentB = allStudentsFromMaster[b];
    if (studentA && studentA.studentName && studentB && studentB.studentName) {
        return studentA.studentName.localeCompare(studentB.studentName);
    }
    return a.localeCompare(b); // Fallback to ID sort if names are missing/problematic
  });

  for (const studentId of studentIdsFromMasterSorted) { 
      const studentDetails = allStudentsFromMaster[studentId];
      // Ensure studentDetails is valid and has studentId and studentName (even if placeholder)
      if (studentDetails && studentDetails.studentId) { 
          let studentRowValues = new Array(expectedHeadersInOrder.length).fill(""); // Initialize with empty strings
          studentRowValues[studentIdColTargetIdx] = studentDetails.studentId; 
          if (studentNameColTargetIdx !== undefined) { // Check if studentNameHeader was actually found
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
      // ui.alert("Info", `No students to populate into ${targetSheetName}.`, ui.ButtonSet.OK); // Can be noisy
      // No need to proceed if no students in the sheet.
      return;
  }
  
  // Get the data from the sheet again, now that it's populated with students
  var finalTargetSheetData = targetSheet.getDataRange().getValues(); 
  
  // --- Calculate Weighted Scores and Prepare Updates ---
  var updatesForSheet = []; // Array of objects: { row: 1-based, col: 1-based, value: ... }
  
  // Iterate through students as they appear in the target sheet (finalTargetSheetData)
  // Start r from 1 to skip header row in finalTargetSheetData (which is 0-indexed array)
  for (let r = 1; r < finalTargetSheetData.length; r++) { // r is 0-indexed for finalTargetSheetData, corresponds to sheet row r+1
    const evaluatedStudentId = finalTargetSheetData[r][studentIdColTargetIdx] ? finalTargetSheetData[r][studentIdColTargetIdx].toString().trim() : null;
    
    if (!evaluatedStudentId || !allStudentsFromMaster[evaluatedStudentId]) { 
        Logger.log(`Skipping sheet row ${r+1} (data array index ${r}), student ID '${finalTargetSheetData[r][studentIdColTargetIdx]}' not in active master list or is null.`);
        continue;
    }

    let studentQuestionScoresForMedian = []; // Stores the final calculated score for each question for this student
    
    // Iterate through the sorted question IDs (e.g., "Q01", "Q02")
    for (const questionId of sortedQuestionIds) { // questionId is UPPERCASE here
      const targetSheetQuestionColNum = questionColMapTarget[questionId]; // Get 1-based column number
      
      if (!targetSheetQuestionColNum) {
        Logger.log(`Warning: Column for question ${questionId} (header: ${questionId.toLowerCase()}) not found in target sheet map for student ${evaluatedStudentId}. Skipping this question for this student.`);
        continue;
      }
      
      let weightedScoreSum = 0;
      let totalWeightSum = 0;
      let scoresForThisItemCount = 0; // Count of evaluations with weight > 0
      let unweightedScores = [];     // All scores for this item, regardless of weight

      responses.forEach(resp => {
        if (resp.evaluatedStudentId === evaluatedStudentId &&
            resp.responseToQuestionId === questionId && // questionId is already uppercase
            resp.responseType === "SCORE" && typeof resp.responseValue === 'number' && !isNaN(resp.responseValue)) {
          
          unweightedScores.push(resp.responseValue);
          const evaluatorId = resp.responseByStudentId;
          
          // Get weight. Default to 0 if evaluatorId is null, or not in weights map, or weight is not a number.
          let evaluatorWeight = 0;
          if (evaluatorId && evaluatorWeights && evaluatorWeights.hasOwnProperty(evaluatorId)) {
              const w = evaluatorWeights[evaluatorId];
              if (typeof w === 'number' && !isNaN(w)) {
                  evaluatorWeight = w;
              } else {
                  Logger.log(`Note: Evaluator ${evaluatorId} has a non-numeric or NaN weight (${w}). Treating as 0 for this calculation.`);
              }
          }
          
          if (evaluatorWeight > 0) { // Only include if weight > 0
            weightedScoreSum += resp.responseValue * evaluatorWeight;
            totalWeightSum += evaluatorWeight;
            scoresForThisItemCount++;
          }
        }
      });

      let finalScoreForQuestion = ""; // Default to blank
      if (scoresForThisItemCount > 0 && totalWeightSum > 0) {
        finalScoreForQuestion = weightedScoreSum / totalWeightSum;
      } else if (unweightedScores.length > 0) { 
        // Fallback: If no scores with weight > 0, but there are unweighted scores, use the mean of unweighted.
        Logger.log(`Info: Zero total weight for ${evaluatedStudentId} on ${questionId}. Using MEAN of ${unweightedScores.length} unweighted scores as fallback.`);
        finalScoreForQuestion = calculateMean(unweightedScores); 
      } else {
        // No scores at all for this item. finalScoreForQuestion remains ""
        // Logger.log(`Info: No scores (weighted or unweighted) found for ${evaluatedStudentId} on ${questionId}. Cell will be blank.`);
      }
      
      if (typeof finalScoreForQuestion === 'number' && !isNaN(finalScoreForQuestion)) {
        studentQuestionScoresForMedian.push(finalScoreForQuestion); // Add to list for overall median calc
        updatesForSheet.push({ 
            row: r + 1, // 1-based sheet row
            col: targetSheetQuestionColNum, 
            value: parseFloat(finalScoreForQuestion.toFixed(2))
        });
      } else {
         updatesForSheet.push({ // Ensure cell is blanked if no score
            row: r + 1, 
            col: targetSheetQuestionColNum, 
            value: ""
        });
      }
    } // End loop through questions

    // Calculate overall median for the student if they have any question scores
    if (studentQuestionScoresForMedian.length > 0 && overallMedianColNum > 0) {
        let overallMedianValue = calculateMedianFromArray(studentQuestionScoresForMedian); 
        if (typeof overallMedianValue === 'number' && !isNaN(overallMedianValue)) {
            updatesForSheet.push({
                row: r + 1, 
                col: overallMedianColNum,
                value: parseFloat(overallMedianValue.toFixed(2))
            });
        } else { // Median calculation resulted in NaN or non-number
            updatesForSheet.push({ row: r + 1, col: overallMedianColNum, value: "" });
        }
    } else if (overallMedianColNum > 0) { // No question scores, ensure median cell is blank
        updatesForSheet.push({
            row: r + 1, 
            col: overallMedianColNum,
            value: ""
        });
    }
  } // End loop through students in target sheet
  Logger.log("WEIGHTED scores and overall medians calculated for batch update. Total updates to apply: " + updatesForSheet.length);

  // --- Apply Updates to the Sheet ---
  if (updatesForSheet.length > 0) {
    // Batching updates can be faster for very large datasets, but individual updates are simpler here.
    // For very large sheets, consider SpreadsheetApp.RangeList#setValues() if performance is an issue.
    updatesForSheet.forEach(update => { 
        if (update.row > 0 && update.col > 0) { // Basic sanity check for row/col
            targetSheet.getRange(update.row, update.col)
                       .setValue(update.value)
                       .setNumberFormat((update.value === "" || typeof update.value !== 'number' || isNaN(update.value)) ? "@" : "0.00");
        }
    });
    try { // Auto-resize can sometimes fail on very complex sheets or if hidden columns exist
        targetSheet.autoResizeColumns(1, expectedHeadersInOrder.length);
    } catch (e) {
        Logger.log(`Warning: autoResizeColumns failed. Error: ${e.message}`);
    }
    Logger.log(`Updated score/median cells in "${targetSheetName}".`);
    ui.alert("Weighted Scores Updated", `WEIGHTED scores and overall medians updated in "${targetSheetName}".`, ui.ButtonSet.OK);
  } else {
    Logger.log("No WEIGHTED scores or medians to update in target sheet (updatesForSheet array was empty).");
    // ui.alert("No Updates", "No scores or medians were calculated or updated in the target sheet.", ui.ButtonSet.OK); // Can be noisy
  }
  ss.setActiveSheet(targetSheet); 
  Logger.log(`--- calculateWeightedScoresAndUpdateSheet: Complete (Using V2 Parser for ${targetSheetName}) ---`);
}