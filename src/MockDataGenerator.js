/**
 * Populates the 'PaRawSubmissionsV2' sheet with mock peer assessment data.
 * Reads student list from 'PaMasterStudentList' and questions from 'PaQuestionConfig'.
 * Assumes 'createResponse', 'isValidProductionUnit', 'extractStudentIdFromEmail', 
 * 'isValidShuEmail', 'calculateMean', 'calculateStdDev', 'calculateMedianFromArray' 
 * are available (likely in Utils.gs or Models.gs).
 * Assumes sheet name constants (PA_...) are defined in Config.gs.
 */
// eslint-disable-next-line no-unused-vars
function populateMockPaRawSubmissionsV2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  Logger.clear();
  Logger.log("--- Starting Mock Data Population for PaRawSubmissionsV2 ---");

  const studentListSheetName = PA_MASTER_STUDENT_LIST_SHEET_NAME;
  const questionConfigSheetName = PA_QUESTION_CONFIG_SHEET_NAME;
  const targetSheetName = PA_RAW_SUBMISSIONS_V2_SHEET_NAME;

  const studentSheet = ss.getSheetByName(studentListSheetName);
  const questionSheet = ss.getSheetByName(questionConfigSheetName);
  let targetSheet = ss.getSheetByName(targetSheetName); 

  if (!studentSheet || !questionSheet) {
    ui.alert("Prerequisite Error", "One or more required source sheets (PaMasterStudentList or PaQuestionConfig) not found.", ui.ButtonSet.OK);
    Logger.log("ERROR: Missing PaMasterStudentList or PaQuestionConfig sheet.");
    return;
  }
  if (!targetSheet) {
    targetSheet = ss.insertSheet(targetSheetName);
    targetSheet.appendRow([
        "submissionId", "responseId", "timestamp", "evaluatorId", "evaluatorEmail", 
        "evaluatedStudentId", "evaluatedStudentName", "unitContextOfEvaluation", 
        "questionId", "responseType", "responseValue"
    ]);
    targetSheet.getRange(1,1,1,11).setFontWeight("bold").setHorizontalAlignment("center");
    targetSheet.setFrozenRows(1);
    Logger.log(`Sheet "${targetSheetName}" created with headers.`);
  }

  // Clear existing mock data except headers from targetSheet
  if (targetSheet.getLastRow() > 1) {
    targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, targetSheet.getMaxColumns()).clearContent(); // Clear all columns
    Logger.log(`Cleared existing data from ${targetSheetName} (rows 2 and below).`);
  }

  // --- Get Students from PaMasterStudentList (Dynamically find columns) ---
  const studentListData = studentSheet.getDataRange().getValues();
  if (studentListData.length < 2) {
    ui.alert("Data Error", `"${studentListSheetName}" is empty or has no student data.`, ui.ButtonSet.OK);
    return;
  }
  const studentListHeaders = studentListData[0].map(h => h ? h.toString().trim() : "");
  
  const idColIdx = studentListHeaders.indexOf("studentId");
  const nameColIdx = studentListHeaders.indexOf("studentName");
  const unit1ColIdx = studentListHeaders.indexOf("unit1");
  const emailColIdx = studentListHeaders.indexOf("email");
  const statusColIdx = studentListHeaders.indexOf("status");

  if (idColIdx === -1 || nameColIdx === -1 || unit1ColIdx === -1 || statusColIdx === -1 || emailColIdx === -1) {
    ui.alert("Sheet Format Error", `One or more required headers (studentId, studentName, unit1, email, status) not found in "${studentListSheetName}".`, ui.ButtonSet.OK);
    Logger.log(`ERROR: Missing headers in ${studentListSheetName}. id:${idColIdx}, name:${nameColIdx}, unit1:${unit1ColIdx}, email:${emailColIdx}, status:${statusColIdx}. Found: ${studentListHeaders.join(',')}`);
    return;
  }

  let activeStudentsByUnit = {}; 
  let allActiveStudentObjects = {}; 

  for (let i = 1; i < studentListData.length; i++) {
    const row = studentListData[i];
    const id = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
    const name = row[nameColIdx] ? row[nameColIdx].toString().trim() : null;
    let unit1Raw = row[unit1ColIdx] ? row[unit1ColIdx].toString().trim().toUpperCase() : null;
    const status = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : null;
    const email = row[emailColIdx] ? row[emailColIdx].toString().trim().toLowerCase() : null;

    let unit1 = unit1Raw;
    if (unit1Raw && unit1Raw.startsWith("UNIT ") && unit1Raw.length > 5) unit1 = unit1Raw.substring(5,6);

    if (id && name && email && (status === "enrolled" || status === "active") && unit1 && isValidProductionUnit(unit1)) {
      const studentObj = { studentId: id, studentName: name, email: email, unit: unit1 };
      if (!activeStudentsByUnit[unit1]) {
        activeStudentsByUnit[unit1] = [];
      }
      activeStudentsByUnit[unit1].push(studentObj);
      allActiveStudentObjects[id] = studentObj;
    }
  }
  Logger.log(`Loaded ${Object.keys(allActiveStudentObjects).length} active students, grouped into ${Object.keys(activeStudentsByUnit).length} units.`);

  // --- Get Questions from PaQuestionConfig ---
  const questionConfigData = questionSheet.getDataRange().getValues();
   if (questionConfigData.length < 2) {
    ui.alert("Data Error", `"${questionConfigSheetName}" is empty or has no question data.`, ui.ButtonSet.OK);
    return;
  }
  const questionConfigHeaders = questionConfigData[0].map(h => h ? h.toString().trim() : "");
  const qcfgIdColIdx = questionConfigHeaders.indexOf("QuestionID"); 

  if (qcfgIdColIdx === -1) {
     ui.alert("Sheet Format Error", `Header "QuestionID" not found in "${questionConfigSheetName}".`, ui.ButtonSet.OK);
     Logger.log(`ERROR: Missing "QuestionID" header in ${questionConfigSheetName}.`);
     return;
  }

  let questions = []; 
  for (let i = 1; i < questionConfigData.length; i++) {
    if (questionConfigData[i][qcfgIdColIdx]) {
      questions.push(questionConfigData[i][qcfgIdColIdx].toString().trim().toUpperCase());
    }
  }
  if (questions.length === 0) {
    ui.alert("Error", "No questions found in PaQuestionConfig sheet.", ui.ButtonSet.OK);
    return;
  }
  Logger.log(`Loaded ${questions.length} question IDs from ${questionConfigSheetName}.`);

  // --- Generate Mock Submissions ---
  let mockSubmissionsDataRows = []; // Array to hold all row data to be written

  const unitsToProcess = Object.keys(activeStudentsByUnit);
  if (unitsToProcess.length === 0) {
    Logger.log("No active units with students to generate mock data for.");
    ui.alert("Info", "No active students found in units to generate mock evaluations.", ui.ButtonSet.OK);
    return;
  }

  for (const unit of unitsToProcess) {
    const evaluatorsInUnit = activeStudentsByUnit[unit];
    const evaluateesInUnit = activeStudentsByUnit[unit];

    for (const evaluator of evaluatorsInUnit) {
      for (const evaluatee of evaluateesInUnit) {
        if (evaluator.studentId === evaluatee.studentId) continue; // Students don't evaluate themselves in this mock

        const submissionTime = new Date(); // Time for this specific submission event
        const timestampForIdPart = Utilities.formatDate(submissionTime, Session.getScriptTimeZone(), "yyyyMMddHHmmss");
        const isoTimestampForSheet = submissionTime.toISOString(); // Consistent timestamp for all responses in this submission
        const sessionSuffix = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3-char random for session ID part
        
        const currentSubmissionId = `SUBM_${evaluator.studentId}_${evaluatee.studentId}_${timestampForIdPart}_${sessionSuffix}`;

        // Each student answers a random subset of questions for each peer
        const numQuestionsToAnswer = Math.floor(Math.random() * (questions.length * 0.5)) + Math.min(3, questions.length); // Answer 3 to ~half
        const shuffledQuestions = questions.slice().sort(() => 0.5 - Math.random()); 
        
        for (let qIdx = 0; qIdx < Math.min(numQuestionsToAnswer, shuffledQuestions.length); qIdx++) {
          const questionId = shuffledQuestions[qIdx];
          
          // Add SCORE response
          const score = Math.floor(Math.random() * 5) + 1; // Random score 1-5
          // Call createResponse - assumed to be in Models.gs and accessible
          const scoreResponseObject = createResponse(
            questionId, 
            score, 
            evaluator.email, 
            "SCORE", 
            evaluatee.studentId, 
            isoTimestampForSheet, 
            unit // unitContextOfEvaluation is the unit they are evaluating within
          );
          if (scoreResponseObject) {
            mockSubmissionsDataRows.push([
              currentSubmissionId, scoreResponseObject.responseId, scoreResponseObject.timestamp,
              evaluator.studentId, evaluator.email, evaluatee.studentId, evaluatee.studentName,
              scoreResponseObject.unitContextOfEvaluation, scoreResponseObject.responseToQuestionId, 
              scoreResponseObject.responseType, scoreResponseObject.responseValue
            ]);
          }

          // Occasionally add a COMMENT
          if (Math.random() < 0.4) { // 40% chance of comment
            const commentText = `Mock comment for ${evaluatee.studentName} on ${questionId}. Detail: ${Math.random().toString(36).substring(7)}.`;
            const commentResponseObject = createResponse(
              questionId,
              commentText,
              evaluator.email,
              "COMMENT",
              evaluatee.studentId,
              isoTimestampForSheet,
              unit 
            );
             if (commentResponseObject) {
                mockSubmissionsDataRows.push([
                  currentSubmissionId, commentResponseObject.responseId, commentResponseObject.timestamp,
                  evaluator.studentId, evaluator.email, evaluatee.studentId, evaluatee.studentName,
                  commentResponseObject.unitContextOfEvaluation, commentResponseObject.responseToQuestionId, 
                  commentResponseObject.responseType, commentResponseObject.responseValue
                ]);
             }
          }
        }
        Utilities.sleep(50); // Slight delay to ensure `new Date()` for next submissionId is different if loop is very fast
      }
    }
  }

  // --- Write Mock Data to Sheet ---
  if (mockSubmissionsDataRows.length > 0) {
    // Data starts from row 2 (row 1 is headers)
    targetSheet.getRange(2, 1, mockSubmissionsDataRows.length, mockSubmissionsDataRows[0].length).setValues(mockSubmissionsDataRows);
    Logger.log(`Populated ${mockSubmissionsDataRows.length} mock response rows into ${targetSheetName}.`);
    ui.alert("Mock Data Generated", `${mockSubmissionsDataRows.length} mock response rows added to ${targetSheetName}.`, ui.ButtonSet.OK);
  } else {
    Logger.log("No mock submissions were generated (e.g., insufficient active students/units or questions).");
    ui.alert("Info", "No mock submissions generated. Check student list (active/enrolled, valid units), and question config.", ui.ButtonSet.OK);
  }
  Logger.log("--- Mock Data Population for PaRawSubmissionsV2 Complete ---");
}