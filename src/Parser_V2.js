// ===================================================================================
// FILE: Parser_V2.gs
// Purpose: To parse data from the NEW survey response format ("PaRawSubmissionsV2"),
//          question configurations ("PaQuestionConfig"),
//          and the master student list ("PaMasterStudentList").
// ===================================================================================

/**
 * Reads the 'PaQuestionConfig' sheet and returns an object map of Question objects.
 */
function getQuestionDefinitions() { // Ensure this function is also in Parser_V2.gs or accessible (e.g., Utils.gs)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  Logger.log("getQuestionDefinitions: Starting to read PaQuestionConfig.");

  const configSheetName = PA_QUESTION_CONFIG_SHEET_NAME; 
  const sheet = ss.getSheetByName(configSheetName);
  let questionsMap = {}; 

  if (!sheet) {
    Logger.log(`getQuestionDefinitions ERROR: Question config sheet "${configSheetName}" not found.`);
    ui.alert("Configuration Error", `Sheet "${configSheetName}" not found.`, ui.ButtonSet.OK);
    return questionsMap; 
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) { 
    Logger.log(`getQuestionDefinitions WARNING: Sheet "${configSheetName}" is empty or has only headers.`);
    return questionsMap;
  }

  const headers = data[0].map(h => h ? h.toString().trim() : ""); 
  
  const idColConfigIdx = headers.indexOf("QuestionID");
  const textColConfigIdx = headers.indexOf("QuestionText");
  const typeColConfigIdx = headers.indexOf("QuestionType");
  const choicesColConfigIdx = headers.indexOf("Choices");
  const instructionColConfigIdx = headers.indexOf("InstructionalComment");

  if (idColConfigIdx === -1 || textColConfigIdx === -1 || typeColConfigIdx === -1 ) {
    Logger.log(`getQuestionDefinitions ERROR: Required headers (QuestionID, QuestionText, QuestionType) not found in "${configSheetName}". Found: [${headers.join(', ')}]`);
    ui.alert("Configuration Error", `Required headers missing in "${configSheetName}".`, ui.ButtonSet.OK);
    return questionsMap; 
  }

  for (let i = 1; i < data.length; i++) { 
    const row = data[i];
    const qId = (idColConfigIdx !== -1 && row[idColConfigIdx]) ? row[idColConfigIdx].toString().trim().toUpperCase() : null;
    const qText = (textColConfigIdx !== -1 && row[textColConfigIdx]) ? row[textColConfigIdx].toString().trim() : null;
    
    if (qId && qText) { 
      const qType = (typeColConfigIdx !== -1 && row[typeColConfigIdx]) ? row[typeColConfigIdx].toString().trim() : "LikertScale";
      const qChoices = (choicesColConfigIdx !== -1 && row[choicesColConfigIdx]) ? row[choicesColConfigIdx].toString().trim() : "";
      const qInstruction = (instructionColConfigIdx !== -1 && row[instructionColConfigIdx]) ? row[instructionColConfigIdx].toString().trim() : "";

      let questionObject = createQuestion(qId, qText, qInstruction, qType, qChoices); 
      if (questionObject && questionObject.isValid()) { 
        questionsMap[questionObject.questionId] = questionObject; 
      } else {
        Logger.log(`getQuestionDefinitions: Skipped creating question from row ${i+1}. ID='${qId}', Text='${qText}'`);
      }
    } else if (qId || qText) { 
        Logger.log(`getQuestionDefinitions: Skipped row ${i+1} in "${configSheetName}" due to missing QuestionID or QuestionText.`);
    }
  }
  Logger.log(`getQuestionDefinitions: Loaded ${Object.keys(questionsMap).length} question definitions from "${configSheetName}".`);
  return questionsMap;
}


/**
 * Parses raw survey data from the NEW V2 format ("PaRawSubmissionsV2"),
 * question configurations ("PaQuestionConfig"), and the master student list ("PaMasterStudentList").
 * Filters students by status ('active' or 'enrolled').
 * Creates standardized student, question, and response objects.
 * @return {object|null} An object { students, questions, responses } or null on critical error.
 */
function parseRawSurveyData() { // This is the NEW V2 parser
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi(); 
  Logger.clear(); // Consider if clearing logs here is always desired, or only in testNewParser
  Logger.log("parseRawSurveyData (V2): Starting data parsing from NEW format...");

  const listStudentsSheetName = PA_MASTER_STUDENT_LIST_SHEET_NAME;
  const rawSubmissionsSheetName = PA_RAW_SUBMISSIONS_V2_SHEET_NAME; 

  // --- 1. Get Question Definitions ---
  const questionsFromConfig = getQuestionDefinitions(); // This function is defined above in this file
  if (!questionsFromConfig || Object.keys(questionsFromConfig).length === 0) {
    Logger.log("parseRawSurveyData (V2) ERROR: No questions loaded from config. Aborting.");
    ui.alert("Configuration Error", "No questions were loaded from PaQuestionConfig. Cannot proceed.", ui.ButtonSet.OK);
    return null;
  }

  // --- 2. Process PA_MASTER_STUDENT_LIST ---
  var studentMasterListById = {};   
  var studentMasterListByName = {}; 
  var listStudentsSheet = ss.getSheetByName(listStudentsSheetName);

  if (!listStudentsSheet) { 
      Logger.log(`parseRawSurveyData (V2) ERROR: Sheet "${listStudentsSheetName}" not found.`);
      ui.alert("Prerequisite Error", `Sheet "${listStudentsSheetName}" not found.`, ui.ButtonSet.OK);
      return null; 
  }
  var listStudentsDataWithHeaders = listStudentsSheet.getDataRange().getValues();
  if (listStudentsDataWithHeaders.length < 2) { 
      Logger.log(`parseRawSurveyData (V2) WARNING: Sheet "${listStudentsSheetName}" has no data rows.`);
      // ui.alert("Data Error", `Sheet "${listStudentsSheetName}" is empty or missing data.`, ui.ButtonSet.OK); // Might be too aggressive if allowing empty for some reason
      // return null; // Decide if this should be a critical stop
  }

  var masterHeaders = listStudentsDataWithHeaders[0].map(h => h ? h.toString().trim() : ""); 
  Logger.log(`DEBUG_V2_PARSER (MasterList): Headers found: [${masterHeaders.join(' | ')}]`);

  // Ensure these camelCase strings EXACTLY match your PaMasterStudentList headers
  const idColLsIdx = masterHeaders.indexOf("studentId");
  const nameColLsIdx = masterHeaders.indexOf("studentName");
  const unit1ColLsIdx = masterHeaders.indexOf("unit1");
  const unit2ColLsIdx = masterHeaders.indexOf("unit2"); 
  const emailColLsIdx = masterHeaders.indexOf("email"); 
  const statusColLsIdx = masterHeaders.indexOf("status");

  Logger.log(`DEBUG_V2_PARSER (MasterList): Indices - studentId=${idColLsIdx}, studentName=${nameColLsIdx}, unit1=${unit1ColLsIdx}, unit2=${unit2ColLsIdx}, email=${emailColLsIdx}, status=${statusColLsIdx}`);

  if (idColLsIdx === -1 || nameColLsIdx === -1 || statusColLsIdx === -1) { 
    Logger.log(`parseRawSurveyData (V2) ERROR: Required headers (studentId, studentName, status) not found in "${listStudentsSheetName}". Check PaMasterStudentList headers.`);
    ui.alert("Sheet Format Error", `Required headers (studentId, studentName, status) missing in "${listStudentsSheetName}". Check PaMasterStudentList headers.`, ui.ButtonSet.OK);
    return null;
  }
    
  Logger.log(`parseRawSurveyData (V2): Processing ${listStudentsDataWithHeaders.length - 1} rows from "${listStudentsSheetName}".`);
  for (let i = 1; i < listStudentsDataWithHeaders.length; i++) {
    const rowData = listStudentsDataWithHeaders[i];
    
    // Read studentId from the sheet
    const idFromSheet = (idColLsIdx !== -1 && rowData[idColLsIdx]) ? rowData[idColLsIdx].toString().trim().toUpperCase() : null;
    if (!idFromSheet || !(/^[A-Z]{1}[0-9]{9}$/.test(idFromSheet))) { 
      Logger.log(`DEBUG_V2_PARSER (MasterList Row ${i+1}): Skipping due to invalid/missing studentId: '${rowData[idColLsIdx]}'`);
      continue; 
    }

    let nameFromSheet = `[NameDefaultInParserFor_${idFromSheet}]`;
    if (nameColLsIdx !== -1 && rowData[nameColLsIdx] && rowData[nameColLsIdx].toString().trim() !== "") {
        nameFromSheet = rowData[nameColLsIdx].toString().trim();
    } else {
        Logger.log(`DEBUG_V2_PARSER (MasterList Row ${i+1}): Name issue for ID ${idFromSheet}. RawNameCell='${rowData[nameColLsIdx]}'. Name set to placeholder: '${nameFromSheet}'`);
    }
    
    const statusFromSheet = (statusColLsIdx !== -1 && rowData[statusColLsIdx]) ? rowData[statusColLsIdx].toString().trim().toLowerCase() : "active"; // Default to active if status column exists but cell is blank
    if (!(statusFromSheet === "active" || statusFromSheet === "enrolled")) {
      // Logger.log(`parseRawSurveyData (V2): Skipping inactive student from master: ${idFromSheet} - ${nameFromSheet} (Status: ${statusFromSheet})`);
      continue; 
    }

    let unit1FromSheet = (unit1ColLsIdx !== -1 && rowData[unit1ColLsIdx]) ? rowData[unit1ColLsIdx].toString().trim().toUpperCase() : "";
    if (unit1FromSheet.startsWith("UNIT ") && unit1FromSheet.length > 5) unit1FromSheet = unit1FromSheet.substring(5,6);
    if (unit1FromSheet && !isValidProductionUnit(unit1FromSheet)) unit1FromSheet = ""; 

    let unit2FromSheet = (unit2ColLsIdx !== -1 && rowData[unit2ColLsIdx]) ? rowData[unit2ColLsIdx].toString().trim().toUpperCase() : "";
    if (unit2FromSheet.startsWith("UNIT ") && unit2FromSheet.length > 5) unit2FromSheet = unit2FromSheet.substring(5,6);
    if (unit2FromSheet && !isValidProductionUnit(unit2FromSheet)) unit2FromSheet = ""; 

    let emailFromSheet = ""; // Default to empty, will derive if possible or if col is missing
    if (emailColLsIdx !== -1) { // Email column header exists
        if (rowData[emailColLsIdx] && rowData[emailColLsIdx].toString().trim() !== "") {
            emailFromSheet = rowData[emailColLsIdx].toString().trim().toLowerCase();
            if (!isValidShuEmail(emailFromSheet)) {
                Logger.log(`DEBUG_V2_PARSER (MasterList Row ${i+1}): Invalid email format '${rowData[emailColLsIdx]}' for ID ${idFromSheet}. Will try to derive.`);
                emailFromSheet = ""; // Set to empty so derivation can occur
            }
        } else {
            // Logger.log(`DEBUG_V2_PARSER (MasterList Row ${i+1}): Email cell blank for ID ${idFromSheet}. Trying to derive.`);
            // emailFromSheet is already ""
        }
    } else {
        Logger.log(`DEBUG_V2_PARSER (MasterList Row ${i+1}): Email header not found for ID ${idFromSheet}. Trying to derive.`);
        // emailFromSheet is already ""
    }

    if (!emailFromSheet && idFromSheet) { // If email is still empty, and ID is valid SHU format
        let derivedEmail = idFromSheet.toLowerCase() + "@mail.shu.edu.tw";
        if (isValidShuEmail(derivedEmail)) {
            emailFromSheet = derivedEmail;
            // Logger.log(`DEBUG_V2_PARSER (MasterList Row ${i+1}): Email for ${idFromSheet} derived: '${emailFromSheet}'`);
        } else {
            emailFromSheet = `[NoValidEmailFor_${idFromSheet}]`; 
            Logger.log(`DEBUG_V2_PARSER (MasterList Row ${i+1}): Email for ${idFromSheet} remains placeholder even after derivation attempt.`);
        }
    }
    
    // *** MODIFICATION: Create student object with standardized property names ***
    const studentObjectForMasterList = { 
        studentId: idFromSheet, 
        studentName: nameFromSheet, 
        studentEmail: emailFromSheet, 
        productionUnit1: unit1FromSheet, 
        productionUnit2: unit2FromSheet,
        status: statusFromSheet
    };
    
    studentMasterListById[idFromSheet] = studentObjectForMasterList;
    // Logger.log(`DEBUG_V2_PARSER (MasterList) STORED: studentId=${studentObjectForMasterList.studentId}, Name='${studentObjectForMasterList.studentName}', Email='${studentObjectForMasterList.studentEmail}', Status='${studentObjectForMasterList.status}'`);
    
    if (studentObjectForMasterList.studentName && !studentObjectForMasterList.studentName.startsWith("[")) { 
        if (!studentMasterListByName[studentObjectForMasterList.studentName]) {
            studentMasterListByName[studentObjectForMasterList.studentName] = studentObjectForMasterList; 
        }
    }
  } 
  const allStudentsFromMaster = studentMasterListById; // This is the map of student objects
  Logger.log(`parseRawSurveyData (V2): Populated allStudentsFromMaster with ${Object.keys(allStudentsFromMaster).length} active students.`);
  
  if (Object.keys(allStudentsFromMaster).length === 0 && listStudentsDataWithHeaders.length > 1) { // Only alert if master list had rows but none were active/valid
    ui.alert("Data Error", `No active/enrolled students loaded from "${listStudentsSheetName}". Check student statuses and IDs.`, ui.ButtonSet.OK);
    // return null; // Decide if this is critical. For now, allow proceeding to see if any responses can be processed (e.g. if mock data is independent)
  }

  // --- 3. Process PA_RAW_SUBMISSIONS_V2 (New Format Responses) ---
  var surveySheet = ss.getSheetByName(rawSubmissionsSheetName);
  let responsesArray = [];

  if (!surveySheet) { 
      Logger.log(`parseRawSurveyData (V2) WARNING: Raw submissions sheet "${rawSubmissionsSheetName}" not found. Returning with students and questions only.`);
      // ui.alert("Data Warning", `Sheet "${rawSubmissionsSheetName}" not found. No responses will be processed.`, ui.ButtonSet.OK);
      return { 
        students: allStudentsFromMaster, 
        questions: questionsFromConfig, 
        responses: responsesArray // Empty
      };
  }
  var rawDataFromSurvey = surveySheet.getDataRange().getValues(); 
  if (rawDataFromSurvey.length < 2) { 
      Logger.log(`parseRawSurveyData (V2) INFO: Raw submissions sheet "${rawSubmissionsSheetName}" is empty or has only headers. No responses to process.`);
      return { 
        students: allStudentsFromMaster, 
        questions: questionsFromConfig, 
        responses: responsesArray // Empty
      };
  }
  var submissionHeaders = rawDataFromSurvey[0].map(h => h ? h.toString().trim() : "");

  // Ensure these camelCase strings EXACTLY match your PaRawSubmissionsV2 headers
  const evaluatorIdCol = submissionHeaders.indexOf("evaluatorId");
  const evaluatedStudentIdCol = submissionHeaders.indexOf("evaluatedStudentId");
  // const evaluatorEmailCol = submissionHeaders.indexOf("evaluatorEmail"); // We will use email from master list object
  const evaluatedStudentNameCol = submissionHeaders.indexOf("evaluatedStudentName");
  const questionIdCol = submissionHeaders.indexOf("questionId");
  const responseTypeCol = submissionHeaders.indexOf("responseType");
  const responseValueCol = submissionHeaders.indexOf("responseValue");
  const timestampCol = submissionHeaders.indexOf("timestamp");
  const unitContextCol = submissionHeaders.indexOf("unitContextOfEvaluation");

  // Validate essential submission headers
  if (evaluatorIdCol === -1 || evaluatedStudentIdCol === -1 || questionIdCol === -1 || responseTypeCol === -1 || responseValueCol === -1) {
      Logger.log(`parseRawSurveyData (V2) ERROR: Required headers missing in "${rawSubmissionsSheetName}". Found: [${submissionHeaders.join(', ')}]. Check (evaluatorId, evaluatedStudentId, questionId, responseType, responseValue).`);
      ui.alert("Submission Sheet Error", `Required headers missing in "${rawSubmissionsSheetName}". Cannot process responses.`, ui.ButtonSet.OK);
      return { students: allStudentsFromMaster, questions: questionsFromConfig, responses: [] }; // Return what we have
  }

  Logger.log(`parseRawSurveyData (V2): Processing ${rawDataFromSurvey.length - 1} response rows from "${rawSubmissionsSheetName}".`);

  for (let i = 1; i < rawDataFromSurvey.length; i++) {
    const row = rawDataFromSurvey[i];
    
    const evaluatorIdFromRow = (evaluatorIdCol !== -1 && row[evaluatorIdCol]) ? row[evaluatorIdCol].toString().trim().toUpperCase() : null;
    const evaluatedStudentIdFromRow = (evaluatedStudentIdCol !== -1 && row[evaluatedStudentIdCol]) ? row[evaluatedStudentIdCol].toString().trim().toUpperCase() : null;
    const evaluatedStudentNameFromRow = (evaluatedStudentNameCol !== -1 && row[evaluatedStudentNameCol]) ? row[evaluatedStudentNameCol].toString().trim() : ""; 
    
    const questionIdFromRow = (questionIdCol !== -1 && row[questionIdCol]) ? row[questionIdCol].toString().trim().toUpperCase() : null;
    const responseTypeFromRow = (responseTypeCol !== -1 && row[responseTypeCol]) ? row[responseTypeCol].toString().trim().toUpperCase() : null;
    const responseValueFromRow = (responseValueCol !== -1) ? row[responseValueCol] : undefined; 
    const timestampFromRow = (timestampCol !== -1 && row[timestampCol]) ? row[timestampCol].toString() : new Date().toISOString();
    let unitContextFromRow = (unitContextCol !== -1 && row[unitContextCol]) ? row[unitContextCol].toString().trim().toUpperCase() : "";
    if (unitContextFromRow && !isValidProductionUnit(unitContextFromRow)) unitContextFromRow = ""; 

    if (!evaluatorIdFromRow || !evaluatedStudentIdFromRow || !questionIdFromRow || !responseTypeFromRow || responseValueFromRow === undefined || responseValueFromRow === null) {
        Logger.log(`parseRawSurveyData (V2) WARNING: Skipping survey row ${i+1} due to missing essential data (IDs, QID, Type, Value). EvaluatorID: ${evaluatorIdFromRow}, EvaluatedID: ${evaluatedStudentIdFromRow}, QID: ${questionIdFromRow}`);
        continue;
    }

    const evaluator = allStudentsFromMaster[evaluatorIdFromRow]; // This is now an object like { studentId, studentName, studentEmail, ... }
    if (!evaluator) {
        Logger.log(`parseRawSurveyData (V2) WARNING: Evaluator ID '${evaluatorIdFromRow}' from survey row ${i+1} not found in active master list. Skipping response.`);
        continue; 
    }

    // *** THIS CRITICAL CHECK SHOULD NOW WORK AS EXPECTED ***
    if (!evaluator.studentId || !evaluator.studentEmail || !isValidShuEmail(evaluator.studentEmail)) {
        Logger.log(`parseRawSurveyData (V2) CRITICAL: Active Evaluator '${evaluator.studentId || evaluatorIdFromRow}' from master list has invalid/missing studentId or studentEmail ('${evaluator.studentEmail || 'undefined'}'). Skipping response.`);
        continue;
    }
    const finalEvaluatorEmailForResponse = evaluator.studentEmail; // Use the standardized studentEmail

    let evaluatedStudent = allStudentsFromMaster[evaluatedStudentIdFromRow]; // Will be { studentId, studentName, ... } if found
    if (!evaluatedStudent) {
        // If not in master, try to create a placeholder, especially if it's an "UNKNOWNID_"
        // or if you want to process responses for students not (yet) in master.
        // The createStudent function needs to be robust.
        Logger.log(`parseRawSurveyData (V2) INFO: Evaluated ID '${evaluatedStudentIdFromRow}' (Name from sheet: '${evaluatedStudentNameFromRow}') not in active master. Attempting to create/resolve.`);
        evaluatedStudent = createStudent({
            id: evaluatedStudentIdFromRow, 
            name: evaluatedStudentNameFromRow, // Name from submission if available
            // Pass the master lists so createStudent can try to reconcile if needed,
            // though for a simple placeholder, it might not use them if ID is UNKNOWN.
            studentMasterListById: allStudentsFromMaster, 
            studentMasterListByName: studentMasterListByName 
        }); 
        
        if (!evaluatedStudent || !evaluatedStudent.studentId) { 
            Logger.log(`parseRawSurveyData (V2) WARNING: Failed to create/resolve placeholder for evaluated student ID '${evaluatedStudentIdFromRow}' from survey row ${i+1}. Skipping response.`);
            continue; 
        }
        // Optionally, add this newly created student to allStudentsFromMaster if you want it available for other processing steps
        // allStudentsFromMaster[evaluatedStudent.studentId] = evaluatedStudent; 
        // Logger.log(`parseRawSurveyData (V2) INFO: Dynamically added student '${evaluatedStudent.studentId}' to master list for this session.`);
    }
    // By now, evaluatedStudent should be a valid student object (either from master or created)
    const finalEvaluatedStudentIdForResponse = evaluatedStudent.studentId; 
    
    if (!questionsFromConfig[questionIdFromRow]){ 
        Logger.log(`parseRawSurveyData (V2) WARNING: Skipping survey row ${i+1} - QID '${questionIdFromRow}' not in PaQuestionConfig.`); 
        continue; 
    }
    
    let actualResponseValue = responseValueFromRow;
    if (responseTypeFromRow === "SCORE") {
        actualResponseValue = parseFloat(responseValueFromRow);
        if (isNaN(actualResponseValue)) { 
            Logger.log(`parseRawSurveyData (V2) WARNING: Score value '${responseValueFromRow}' for QID '${questionIdFromRow}' (Evaluator: ${evaluatorIdFromRow}, Evaluated: ${finalEvaluatedStudentIdForResponse}) is not a number. Skipping response.`); 
            continue; 
        }
    }

    const responseObj = createResponse(
            questionIdFromRow, actualResponseValue, finalEvaluatorEmailForResponse, 
            responseTypeFromRow, finalEvaluatedStudentIdForResponse, 
            timestampFromRow, unitContextFromRow
    );

    if (responseObj && responseObj.isValid()) { 
        responsesArray.push(responseObj); 
    } else { 
        Logger.log(`parseRawSurveyData (V2) WARNING: Invalid response object created for QID '${questionIdFromRow}', Eval by '${finalEvaluatorEmailForResponse}'. Response object: ${JSON.stringify(responseObj)}`); 
    }
  } 

  Logger.log(`parseRawSurveyData (V2): Final counts - Master Students: ${Object.keys(allStudentsFromMaster).length}, Questions: ${Object.keys(questionsFromConfig).length}, Responses: ${responsesArray.length}`);
  return { 
    students: allStudentsFromMaster, 
    questions: questionsFromConfig, 
    responses: responsesArray 
  };
}