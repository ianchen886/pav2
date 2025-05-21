// ===================================================================================
// FILE: Parser_V1.gs
// Purpose: To parse data from the OLD survey response format ("PaRawSubmissionsV1")
//          and the master student list ("PaMasterStudentList").
// ===================================================================================

/**
 * Parses raw survey data from the V1 format and the master student list.
 * Filters students by status ('active' or 'enrolled').
 * Creates standardized student, question, and response objects.
 * @return {object|null} An object { students, questions, responses } or null on critical error.
 */
function parseRawSurveyData_v1() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi(); 
  Logger.clear(); 
  Logger.log("parseRawSurveyData_v1: Starting data parsing...");

  const listStudentsSheetName = PA_MASTER_STUDENT_LIST_SHEET_NAME;
  const responseSheetName = PA_RAW_SUBMISSIONS_V1_SHEET_NAME; 

  // --- 1. Process PA_MASTER_STUDENT_LIST ---
  var listStudentsSheet = ss.getSheetByName(listStudentsSheetName);
  if (!listStudentsSheet) {
    Logger.log(`parseRawSurveyData_v1 ERROR: Sheet "${listStudentsSheetName}" not found.`);
    ui.alert("Prerequisite Error", `Sheet "${listStudentsSheetName}" not found. This sheet is required.`, ui.ButtonSet.OK);
    return null;
  }
  var listStudentsDataWithHeaders = listStudentsSheet.getDataRange().getValues();

  if (listStudentsDataWithHeaders.length < 2) { 
    Logger.log(`parseRawSurveyData_v1 WARNING: Sheet "${listStudentsSheetName}" has no data rows or only headers.`);
    ui.alert("Data Error", `Sheet "${listStudentsSheetName}" is empty or missing data rows. Please populate it.`, ui.ButtonSet.OK);
    return null;
  }
  
  var masterHeaders = listStudentsDataWithHeaders[0].map(h => h ? h.toString().trim() : ""); 

  const idColLsIdx = masterHeaders.indexOf("studentId");
  const nameColLsIdx = masterHeaders.indexOf("studentName");
  const unit1ColLsIdx = masterHeaders.indexOf("unit1");
  const unit2ColLsIdx = masterHeaders.indexOf("unit2");
  const emailColLsIdx = masterHeaders.indexOf("email");
  const statusColLsIdx = masterHeaders.indexOf("status");

  if (idColLsIdx === -1 || nameColLsIdx === -1 || statusColLsIdx === -1) { 
    Logger.log(`parseRawSurveyData_v1 ERROR: Required headers (studentId, studentName, status) not found in "${listStudentsSheetName}". Found: [${masterHeaders.join(', ')}]`);
    ui.alert("Sheet Format Error", `Required headers (studentId, studentName, status) missing in "${listStudentsSheetName}". Please ensure sheet has these camelCase headers.`, ui.ButtonSet.OK);
    return null;
  }
    
  var studentMasterListById = {};   
  var studentMasterListByName = {}; 

  Logger.log(`Processing ${listStudentsDataWithHeaders.length - 1} student data rows from "${listStudentsSheetName}".`);
  for (let i = 1; i < listStudentsDataWithHeaders.length; i++) {
    const rowData = listStudentsDataWithHeaders[i];
    const id = rowData[idColLsIdx] ? rowData[idColLsIdx].toString().trim().toUpperCase() : null;
    if (!id || !(/^[A-Z]{1}[0-9]{9}$/.test(id))) { continue; }
    const name = rowData[nameColLsIdx] ? rowData[nameColLsIdx].toString().trim() : null;
    if (!name) { continue; }
    const status = rowData[statusColLsIdx] ? rowData[statusColLsIdx].toString().trim().toLowerCase() : "active";
    if (!(status === "active" || status === "enrolled")) {
      Logger.log(`Skipping inactive student from "${listStudentsSheetName}": ${id} - ${name} (Status: ${status})`);
      continue; 
    }
    let u1 = (unit1ColLsIdx !== -1 && rowData[unit1ColLsIdx]) ? rowData[unit1ColLsIdx].toString().trim().toUpperCase() : "";
    if (u1.startsWith("UNIT ") && u1.length > 5) u1 = u1.substring(5,6);
    if (!isValidProductionUnit(u1)) u1 = ""; 
    let u2 = (unit2ColLsIdx !== -1 && rowData[unit2ColLsIdx]) ? rowData[unit2ColLsIdx].toString().trim().toUpperCase() : "";
    if (u2.startsWith("UNIT ") && u2.length > 5) u2 = u2.substring(5,6);
    if (!isValidProductionUnit(u2)) u2 = ""; 
    let email = (emailColLsIdx !== -1 && rowData[emailColLsIdx]) ? rowData[emailColLsIdx].toString().trim().toLowerCase() : "";
    if (email && !isValidShuEmail(email)) email = ""; 
    if (!email && id && /^[A-Z]{1}[0-9]{9}$/.test(id)) { 
        let derivedEmail = id.toLowerCase() + "@mail.shu.edu.tw";
        if (isValidShuEmail(derivedEmail)) email = derivedEmail;
    }
    const studentDetails = { id: id, name: name, unit1: u1, unit2: u2, email: email, status: status };
    studentMasterListById[id] = studentDetails;
    if (!studentMasterListByName[name]) { studentMasterListByName[name] = studentDetails; }
  } 
  Logger.log(`parseRawSurveyData_v1: Populated studentMasterListById with ${Object.keys(studentMasterListById).length} active/enrolled students.`);
  if (Object.keys(studentMasterListById).length === 0) {
    Logger.log(`parseRawSurveyData_v1 CRITICAL WARNING: No active/enrolled students loaded from "${listStudentsSheetName}".`);
    ui.alert("Critical Data Error", `No active/enrolled students were loaded from "${listStudentsSheetName}". Check sheet content, headers (studentId, studentName, status), and student statuses.`, ui.ButtonSet.OK);
    return null; 
  }

  // --- 2. Process PA_RAW_SUBMISSIONS_V1 (Old Format Responses) ---
  var surveySheet = ss.getSheetByName(responseSheetName);
  if (!surveySheet) { 
    Logger.log(`parseRawSurveyData_v1 ERROR: Response sheet "${responseSheetName}" not found.`); 
    ui.alert("Prerequisite Error", `Response sheet "${responseSheetName}" not found.`, ui.ButtonSet.OK); 
    return null; 
  }
  var rawDataFromSurvey = surveySheet.getDataRange().getValues(); 
  if (rawDataFromSurvey.length < 2) { 
    Logger.log(`parseRawSurveyData_v1 WARNING: Response sheet "${responseSheetName}" has no data rows.`); 
    ui.alert("Data Warning", `Response sheet "${responseSheetName}" has no data rows. Processing will continue with no responses.`, ui.ButtonSet.OK); 
    return { students: studentMasterListById, questions: {}, responses: [] }; 
  }
  var surveyHeaders = rawDataFromSurvey[0].map(h => h ? h.toString().trim() : "");

  const timestampColSurvey = surveyHeaders.indexOf("Timestamp"); 
  const evaluatorUnitColSurvey = surveyHeaders.indexOf("請選擇你的小組："); 
  const firstQuestionScoreColSurvey = surveyHeaders.indexOf("這位同學能清晰且建設性地表達自己的想法、疑慮和回饋。");
  const evaluatorEmailColSurvey = surveyHeaders.indexOf("Email address"); 

  if (timestampColSurvey === -1 || evaluatorUnitColSurvey === -1 || firstQuestionScoreColSurvey === -1 || evaluatorEmailColSurvey === -1) {
      Logger.log(`parseRawSurveyData_v1 ERROR: Essential headers missing in "${responseSheetName}". TS:${timestampColSurvey}, Unit:${evaluatorUnitColSurvey}, FirstQ:${firstQuestionScoreColSurvey}, Email:${evaluatorEmailColSurvey}. Expected headers: "Timestamp", "請選擇你的小組：", "Email address", "這位同學能清晰且建設性地表達自己的想法、疑慮和回饋。"`);
      ui.alert("Response Sheet Format Error", `Essential headers missing in "${responseSheetName}". Please check for "Timestamp", "請選擇你的小組：", "Email address", and the first question header.`, ui.ButtonSet.OK);
      return null;
  }

  const evaluatedStudentNameHeaderByUnit = { 
    "A": "請問你要評估哪位組員？.1", 
    "B": "請問你要評估哪位組員？.2", 
    "C": "請問你要評估哪位組員？.3", 
    "D": "請問你要評估哪位組員？.4"  
  };
  
  let studentsInSurvey = {}; 
  let questions = {};   
  let responses = [];

  let questionCounter = 1;
  for (let h = firstQuestionScoreColSurvey; h < evaluatorEmailColSurvey; h += 2) { 
    if (questionCounter > 25) break; 
    const questionPromptText = surveyHeaders[h] ? surveyHeaders[h].toString().trim() : `Unnamed Question ${questionCounter}`;
    if (!questionPromptText || !questionPromptText.includes("這位同學")) { 
        Logger.log(`Stopping question parsing at header index ${h}: "${questionPromptText}", does not seem like a question.`);
        break;
    }
    const questionId = "Q" + (questionCounter < 10 ? "0" : "") + questionCounter;
    if (!questions[questionId]) {
      let qObj = createQuestion(questionId, questionPromptText, ""); 
      if (qObj) questions[questionId] = qObj;
    }
    questionCounter++;
  }
  Logger.log(`parseRawSurveyData_v1: Defined ${Object.keys(questions).length} questions from survey headers of "${responseSheetName}".`);

  // Process each response row
  for (let i = 1; i < rawDataFromSurvey.length; i++) {
    const row = rawDataFromSurvey[i];
    // Logger.log(`DEBUG: Processing Survey Row ${i + 1}`); 
    const timestamp = row[timestampColSurvey] ? row[timestampColSurvey].toString() : new Date().toISOString();
    
    const evaluatorEmailFromSheet = row[evaluatorEmailColSurvey] ? row[evaluatorEmailColSurvey].toString().trim().toLowerCase() : null;
    const rawUnitContextFromSheet = row[evaluatorUnitColSurvey] ? row[evaluatorUnitColSurvey].toString().trim().toUpperCase() : null;
    
    let parsedUnitLetter = null; 
    if (rawUnitContextFromSheet) {
        if (rawUnitContextFromSheet.startsWith("UNIT ") && rawUnitContextFromSheet.length > 5) parsedUnitLetter = rawUnitContextFromSheet.substring(5, 6);
        else if (["A","B","C","D"].includes(rawUnitContextFromSheet)) parsedUnitLetter = rawUnitContextFromSheet;
    }

    let skipRow = false;
    let skipReason = "";
    if (!evaluatorEmailFromSheet || !isValidShuEmail(evaluatorEmailFromSheet)) { 
      skipRow = true;
      skipReason = `Missing or invalid evaluator email: '${evaluatorEmailFromSheet}'`;
    } else if (!parsedUnitLetter) { 
      skipRow = true;
      skipReason = `Missing or invalid unit selection for evaluator '${evaluatorEmailFromSheet}'. Unit from sheet: '${rawUnitContextFromSheet}'`;
    }
    if (skipRow) {
      // Logger.log(`INFO: Survey Row ${i + 1} - SKIPPING. Reason: ${skipReason}.`); 
      continue; 
    }

    let evaluatorIdDerived = extractStudentIdFromEmail(evaluatorEmailFromSheet);
    let evaluator = studentsInSurvey[evaluatorIdDerived]; 
    
    if (!evaluator) { 
        evaluator = createStudent({ 
            email: evaluatorEmailFromSheet, 
            unit1: parsedUnitLetter, 
            studentMasterListById: studentMasterListById,
            studentMasterListByName: studentMasterListByName
        });
        if (evaluator && evaluator.studentId) {
            studentsInSurvey[evaluator.studentId] = evaluator;
            // Logger.log(`DEBUG: Survey Row ${i+1} - Created/Fetched Evaluator Student object: ID='${evaluator.studentId}', Name='${evaluator.studentName}', Email='${evaluator.email}', Status='${evaluator.status}'`);
        } else {
            Logger.log(`ERROR: Survey Row ${i + 1} - Failed to create valid evaluator Student object for email ${evaluatorEmailFromSheet} (Derived ID: ${evaluatorIdDerived}). Skipping row.`); 
            continue; 
        }
    } else {
        // Logger.log(`DEBUG: Survey Row ${i+1} - Reusing existing Evaluator Student object from survey cache: ID='${evaluator.studentId}', Email='${evaluator.email}'`);
    }

    if (!evaluator || !evaluator.email || !isValidShuEmail(evaluator.email)) {
        Logger.log(`CRITICAL ERROR: Survey Row ${i+1} - Evaluator object for ID ${evaluatorIdDerived} has missing or invalid email ('${evaluator ? evaluator.email : "evaluator_obj_null"}') AFTER createStudent. Skipping responses for this row.`);
        continue;
    }
    const finalEvaluatorEmailForResponse = evaluator.email;
    
    const targetHeaderForEvalName = evaluatedStudentNameHeaderByUnit[parsedUnitLetter];
    let evaluatedStudentNameColIdx = -1;
    if (targetHeaderForEvalName) {
        evaluatedStudentNameColIdx = surveyHeaders.indexOf(targetHeaderForEvalName);
    } else {
        Logger.log(`parseRawSurveyData_v1 (Survey Row ${i + 1}): No target header defined in map for parsed unit '${parsedUnitLetter}'. Eval by: ${finalEvaluatorEmailForResponse}`);
        continue; 
    }
        
    let evaluatedNameInThisRow = "";
    if (evaluatedStudentNameColIdx !== -1 && evaluatedStudentNameColIdx < row.length && row[evaluatedStudentNameColIdx] && row[evaluatedStudentNameColIdx].toString().trim() !== "") {
        evaluatedNameInThisRow = row[evaluatedStudentNameColIdx].toString().trim();
    }

    if (!evaluatedNameInThisRow) { 
      // Logger.log(`parseRawSurveyData_v1 (Survey Row ${i + 1}): No evaluated student name found for unit ${parsedUnitLetter} (Expected Header: ${targetHeaderForEvalName}). Eval by: ${evaluator.studentId}`);
      continue; 
    }
    
    let evaluatedStudent = null;
    let evaluatedStudentIdFromMasterLookup = studentMasterListByName[evaluatedNameInThisRow] ? studentMasterListByName[evaluatedNameInThisRow].id : null;

    if (evaluatedStudentIdFromMasterLookup) {
        evaluatedStudent = studentsInSurvey[evaluatedStudentIdFromMasterLookup]; 
        if (!evaluatedStudent) { 
            evaluatedStudent = createStudent({ 
                id: evaluatedStudentIdFromMasterLookup, 
                name: evaluatedNameInThisRow, 
                studentMasterListById: studentMasterListById, 
                studentMasterListByName: studentMasterListByName
            });
            if (evaluatedStudent && evaluatedStudent.studentId) studentsInSurvey[evaluatedStudent.studentId] = evaluatedStudent;
        }
    } else { 
        Logger.log(`parseRawSurveyData_v1 (Survey Row ${i + 1}): Evaluated name "${evaluatedNameInThisRow}" not in studentMasterListByName. Creating placeholder UNKNOWNID.`);
        let placeholderId = "UNKNOWNID_" + evaluatedNameInThisRow.replace(/\s+/g, "_").toUpperCase();
        evaluatedStudent = studentsInSurvey[placeholderId];
        if (!evaluatedStudent) {
             evaluatedStudent = createStudent({ id: placeholderId, name: evaluatedNameInThisRow, unit1: parsedUnitLetter }); // Assign unit of evaluation context
            if(evaluatedStudent && evaluatedStudent.studentId) studentsInSurvey[placeholderId] = evaluatedStudent; 
        }
    }
    
    if(!evaluatedStudent || !evaluatedStudent.studentId){ 
      Logger.log(`parseRawSurveyData_v1 (Survey Row ${i+1}): Could not establish valid evaluated student for name "${evaluatedNameInThisRow}". Skipping.`); 
      continue; 
    }
    const evaluatedStudentIdForResponse = evaluatedStudent.studentId;

    let currentQNumForResponse = 1;
    for (let j = firstQuestionScoreColSurvey; j < evaluatorEmailColSurvey; j += 2) {
      const questionIdFromLoop = "Q" + (currentQNumForResponse < 10 ? "0" : "") + currentQNumForResponse;
      if (!questions[questionIdFromLoop]) { break; }
      const scoreValue = row[j];
      const commentValue = (j + 1 < evaluatorEmailColSurvey && row[j+1] !== undefined) ? row[j+1] : ""; 

      // Added targeted logging for createResponse inputs
      // Logger.log(`DEBUG RESPONSE: QID=${questionIdFromLoop}, EvalEmail=${finalEvaluatorEmailForResponse}, EvaledID=${evaluatedStudentIdForResponse}, UnitCtx=${parsedUnitLetter}`);

      if (questions[questionIdFromLoop]) { 
        if (scoreValue !== undefined && scoreValue !== null && scoreValue.toString().trim() !== "") {
          let parsedScore = parseFloat(scoreValue);
          if(!isNaN(parsedScore)){
            let scoreResponse = createResponse( questionIdFromLoop, parsedScore, finalEvaluatorEmailForResponse, "SCORE", evaluatedStudentIdForResponse, timestamp, parsedUnitLetter );
            if (scoreResponse) responses.push(scoreResponse);
          } 
        }
        if (commentValue && commentValue.toString().trim() !== "" && commentValue.toString().trim().toLowerCase() !== "無") {
          let commentResponse = createResponse( questionIdFromLoop, commentValue.toString().trim(), finalEvaluatorEmailForResponse, "COMMENT", evaluatedStudentIdForResponse, timestamp, parsedUnitLetter );
          if (commentResponse) responses.push(commentResponse);
        }
      }
      currentQNumForResponse++;
    }
  } 

  Logger.log(`parseRawSurveyData_v1: Final counts - Master Students (active/enrolled): ${Object.keys(studentMasterListById).length}, Questions defined: ${Object.keys(questions).length}, Responses collected: ${responses.length}`);
  return { students: studentMasterListById, questions: questions, responses: responses };
}