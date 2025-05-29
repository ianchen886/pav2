/* global PA_QUESTION_CONFIG_SHEET_NAME, PA_MASTER_STUDENT_LIST_SHEET_NAME, PA_RAW_SUBMISSIONS_V2_SHEET_NAME, createQuestion, createStudent, createResponse, isValidProductionUnit, isValidShuEmail*/

/**
 * @file Parser_V2.js
 * @description This file is responsible for parsing data for the Peer Assessment V2 system.
 * It handles reading and interpreting data from various Google Sheets sources including:
 * - Student evaluation submissions in the new V2 format (from 'PaRawSubmissionsV2').
 * - The master list of all students (from 'PaMasterStudentList').
 * - The configuration of assessment questions (from 'PaQuestionConfig').
 * The main functions in this file transform raw sheet data into standardized JavaScript
 * objects (Student, Question, Response models) to be used by other workflow modules
 * for analytics, scoring, and reporting. It filters for active/enrolled students
 * and includes robust error handling and data validation.
 *
 * @requires Config.js (for sheet name constants like PA_QUESTION_CONFIG_SHEET_NAME)
 * @requires Models.js (for createQuestion, createStudent, createResponse functions)
 * @requires Utils.js (for validation helper functions like isValidProductionUnit, isValidShuEmail)
 */

/**
 * Reads the 'PaQuestionConfig' Google Sheet to retrieve and structure all assessment questions.
 * It expects specific headers (QuestionID, QuestionText, QuestionType, etc.) in the sheet.
 * Each row in the sheet corresponding to a question is transformed into a Question object
 * using the `createQuestion` model function.
 *
 * @function getQuestionDefinitions
 * @returns {Object<string, object>} An object map where keys are question IDs (e.g., "Q01")
 *                                   and values are the corresponding Question objects (as created by Models.js).
 *                                   Returns an empty object if the sheet is not found,
 *                                   is empty, or critical headers are missing.
 */
function getQuestionDefinitions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("getQuestionDefinitions: Starting to read PaQuestionConfig.");

  const configSheetName = PA_QUESTION_CONFIG_SHEET_NAME; 
  const sheet = ss.getSheetByName(configSheetName);
  let questionsMap = {}; 

  if (!sheet) {
    const errorMsg = `getQuestionDefinitions ERROR: Question config sheet "${configSheetName}" not found.`;
    Logger.log(errorMsg);
    throw new Error(errorMsg);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) { 
    Logger.log(`getQuestionDefinitions WARNING: Sheet "${configSheetName}" is empty or has only headers. No questions loaded.`);
    return questionsMap;
  }

  const headers = data[0].map(h => h ? h.toString().trim() : ""); 
  
  const idColConfigIdx = headers.indexOf("QuestionID");
  const textColConfigIdx = headers.indexOf("QuestionText");
  const typeColConfigIdx = headers.indexOf("QuestionType");
  const choicesColConfigIdx = headers.indexOf("Choices");
  const instructionColConfigIdx = headers.indexOf("InstructionalComment");

  if (idColConfigIdx === -1 || textColConfigIdx === -1 || typeColConfigIdx === -1 ) {
    const errorMsg = `getQuestionDefinitions ERROR: Required headers (QuestionID, QuestionText, QuestionType) not found in "${configSheetName}". Found headers: [${headers.join(', ')}]`;
    Logger.log(errorMsg);
    throw new Error(errorMsg);
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
        Logger.log(`getQuestionDefinitions: Skipped creating question from row ${i+1} due to invalid data or createQuestion failure. ID='${qId}', Text='${qText}'`);
      }
    } else if (qId || qText) { 
        Logger.log(`getQuestionDefinitions: Skipped row ${i+1} in "${configSheetName}" due to missing QuestionID or QuestionText.`);
    }
  }
  Logger.log(`getQuestionDefinitions: Loaded ${Object.keys(questionsMap).length} question definitions from "${configSheetName}".`);
  return questionsMap;
}

/**
 * Parses all necessary raw data for the peer assessment system from Google Sheets.
 * This includes:
 *  1. Fetching question definitions using {@link getQuestionDefinitions}.
 *  2. Processing the master student list from 'PaMasterStudentList', filtering for active/enrolled students,
 *     and creating a map of Student objects using `createStudent`.
 *  3. Processing student peer assessment submissions from 'PaRawSubmissionsV2', validating data,
 *     and creating an array of Response objects using `createResponse`.
 *
 * This function serves as the primary data ingestion point for the V2 system and is typically
 * called by workflow functions.
 *
 * @function parseRawSurveyData
 * @returns {{students: Object<string, object>, questions: Object<string, object>, responses: object[]}|null}
 * An object containing student, question, and response data, or null on critical error.
 * - `students`: An object map of active Student objects (from Models.js), keyed by studentId.
 * - `questions`: An object map of Question objects (from Models.js), keyed by questionId.
 * - `responses`: An array of all valid Response objects (from Models.js) parsed from submissions.
 */
// eslint-disable-next-line no-unused-vars
function parseRawSurveyData() { 
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("parseRawSurveyData (V2): Starting data parsing from NEW format...");

  const listStudentsSheetName = PA_MASTER_STUDENT_LIST_SHEET_NAME;
  const rawSubmissionsSheetName = PA_RAW_SUBMISSIONS_V2_SHEET_NAME; 

  // --- 1. Get Question Definitions ---
  const questionsFromConfig = getQuestionDefinitions(); 
  if (!questionsFromConfig || Object.keys(questionsFromConfig).length === 0) {
    const errorMsg = "parseRawSurveyData (V2) ERROR: No questions loaded from config. Aborting.";
    Logger.log(errorMsg);
    throw new Error(errorMsg);
  }

  // --- 2. Process PA_MASTER_STUDENT_LIST ---
  const studentMasterListById = {};
  const studentMasterListByName = {};
  const listStudentsSheet = ss.getSheetByName(listStudentsSheetName);

  if (!listStudentsSheet) { 
      const errorMsg = `parseRawSurveyData (V2) ERROR: Sheet "${listStudentsSheetName}" not found.`;
      Logger.log(errorMsg);
      throw new Error(errorMsg);
  }
  const listStudentsDataWithHeaders = listStudentsSheet.getDataRange().getValues();
  if (listStudentsDataWithHeaders.length < 2) { 
      Logger.log(`parseRawSurveyData (V2) WARNING: Sheet "${listStudentsSheetName}" has no data rows (only headers or empty).`);
  }

  const masterHeaders = listStudentsDataWithHeaders[0].map(h => h ? h.toString().trim() : "");

  const idColLsIdx = masterHeaders.indexOf("studentId");
  const nameColLsIdx = masterHeaders.indexOf("studentName");
  const unit1ColLsIdx = masterHeaders.indexOf("unit1");
  const unit2ColLsIdx = masterHeaders.indexOf("unit2"); 
  const emailColLsIdx = masterHeaders.indexOf("email"); 
  const statusColLsIdx = masterHeaders.indexOf("status");

  if (idColLsIdx === -1 || nameColLsIdx === -1 || statusColLsIdx === -1) { 
    const errorMsg = `parseRawSurveyData (V2) ERROR: Required headers (studentId, studentName, status) not found in "${listStudentsSheetName}". Please check PaMasterStudentList headers.`;
    Logger.log(errorMsg);
    throw new Error(errorMsg);
  }
    
  for (let i = 1; i < listStudentsDataWithHeaders.length; i++) {
    const rowData = listStudentsDataWithHeaders[i];
    
    const idFromSheet = (idColLsIdx !== -1 && rowData[idColLsIdx]) ? rowData[idColLsIdx].toString().trim().toUpperCase() : null;
    if (!idFromSheet || !(/^[A-Z]{1}[0-9]{9}$/.test(idFromSheet))) { 
      continue; 
    }

    let nameFromSheet = `[NameDefaultInParserFor_${idFromSheet}]`;
    if (nameColLsIdx !== -1 && rowData[nameColLsIdx] && rowData[nameColLsIdx].toString().trim() !== "") {
        nameFromSheet = rowData[nameColLsIdx].toString().trim();
    }
    
    const statusFromSheet = (statusColLsIdx !== -1 && rowData[statusColLsIdx]) ? rowData[statusColLsIdx].toString().trim().toLowerCase() : "active"; 
    if (!(statusFromSheet === "active" || statusFromSheet === "enrolled")) {
      continue; 
    }

    let unit1FromSheet = (unit1ColLsIdx !== -1 && rowData[unit1ColLsIdx]) ? rowData[unit1ColLsIdx].toString().trim().toUpperCase() : "";
    if (unit1FromSheet.startsWith("UNIT ") && unit1FromSheet.length > 5) unit1FromSheet = unit1FromSheet.substring(5,6);
    if (unit1FromSheet && !isValidProductionUnit(unit1FromSheet)) unit1FromSheet = ""; 

    let unit2FromSheet = (unit2ColLsIdx !== -1 && rowData[unit2ColLsIdx]) ? rowData[unit2ColLsIdx].toString().trim().toUpperCase() : "";
    if (unit2FromSheet.startsWith("UNIT ") && unit2FromSheet.length > 5) unit2FromSheet = unit2FromSheet.substring(5,6);
    if (unit2FromSheet && !isValidProductionUnit(unit2FromSheet)) unit2FromSheet = ""; 

    let emailFromSheet = ""; 
    if (emailColLsIdx !== -1) { 
        if (rowData[emailColLsIdx] && rowData[emailColLsIdx].toString().trim() !== "") {
            emailFromSheet = rowData[emailColLsIdx].toString().trim().toLowerCase();
            if (!isValidShuEmail(emailFromSheet)) {
                emailFromSheet = ""; 
            }
        }
    }

    if (!emailFromSheet && idFromSheet && /^[A-Z]{1}[0-9]{9}$/.test(idFromSheet)) {
        let derivedEmail = idFromSheet.toLowerCase() + "@mail.shu.edu.tw";
        if (isValidShuEmail(derivedEmail)) {
            emailFromSheet = derivedEmail;
        } else {
            emailFromSheet = `[NoValidEmailFor_${idFromSheet}]`; 
        }
    } else if (!emailFromSheet) {
        emailFromSheet = `[NoEmailProvidedOrDerivedFor_${idFromSheet}]`;
    }
    
    const studentObjectForMasterList = { 
        studentId: idFromSheet, 
        studentName: nameFromSheet, 
        studentEmail: emailFromSheet, 
        productionUnit1: unit1FromSheet, 
        productionUnit2: unit2FromSheet,
        status: statusFromSheet
    };
    
    studentMasterListById[idFromSheet] = studentObjectForMasterList;
    
    if (studentObjectForMasterList.studentName && !studentObjectForMasterList.studentName.startsWith("[")) { 
        if (!studentMasterListByName[studentObjectForMasterList.studentName]) {
            studentMasterListByName[studentObjectForMasterList.studentName] = studentObjectForMasterList; 
        }
    }
  } 
  const allStudentsFromMaster = studentMasterListById; 
  Logger.log(`parseRawSurveyData (V2): Populated allStudentsFromMaster with ${Object.keys(allStudentsFromMaster).length} active/enrolled students.`);

  // --- 3. Process PA_RAW_SUBMISSIONS_V2 (New Format Responses) ---
  const surveySheet = ss.getSheetByName(rawSubmissionsSheetName);
  let responsesArray = [];

  if (!surveySheet) { 
      Logger.log(`parseRawSurveyData (V2) WARNING: Raw submissions sheet "${rawSubmissionsSheetName}" not found. Returning with students and questions only.`);
      return { 
        students: allStudentsFromMaster, 
        questions: questionsFromConfig, 
        responses: responsesArray 
      };
  }
  const rawDataFromSurvey = surveySheet.getDataRange().getValues();
  if (rawDataFromSurvey.length < 2) { 
      Logger.log(`parseRawSurveyData (V2) INFO: Raw submissions sheet "${rawSubmissionsSheetName}" is empty or has only headers. No responses to process.`);
      return { 
        students: allStudentsFromMaster, 
        questions: questionsFromConfig, 
        responses: responsesArray 
      };
  }
  const submissionHeaders = rawDataFromSurvey[0].map(h => h ? h.toString().trim() : "");

  const evaluatorIdCol = submissionHeaders.indexOf("evaluatorId");
  const evaluatedStudentIdCol = submissionHeaders.indexOf("evaluatedStudentId");
  const evaluatedStudentNameCol = submissionHeaders.indexOf("evaluatedStudentName");
  const questionIdCol = submissionHeaders.indexOf("questionId");
  const responseTypeCol = submissionHeaders.indexOf("responseType");
  const responseValueCol = submissionHeaders.indexOf("responseValue");
  const timestampCol = submissionHeaders.indexOf("timestamp");
  const unitContextCol = submissionHeaders.indexOf("unitContextOfEvaluation");

  if (evaluatorIdCol === -1 || evaluatedStudentIdCol === -1 || questionIdCol === -1 || responseTypeCol === -1 || responseValueCol === -1) {
      const errorMsg = `parseRawSurveyData (V2) ERROR: Required headers missing in "${rawSubmissionsSheetName}". Found: [${submissionHeaders.join(', ')}]. Expected: evaluatorId, evaluatedStudentId, questionId, responseType, responseValue.`;
      Logger.log(errorMsg);
      return { students: allStudentsFromMaster, questions: questionsFromConfig, responses: [] }; 
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
    const timestampFromRow = (timestampCol !== -1 && row[timestampCol]) ? (row[timestampCol] instanceof Date ? row[timestampCol].toISOString() : row[timestampCol].toString()) : new Date().toISOString();
    let unitContextFromRow = (unitContextCol !== -1 && row[unitContextCol]) ? row[unitContextCol].toString().trim().toUpperCase() : "";
    if (unitContextFromRow && !isValidProductionUnit(unitContextFromRow)) unitContextFromRow = ""; 

    if (!evaluatorIdFromRow || !evaluatedStudentIdFromRow || !questionIdFromRow || !responseTypeFromRow || responseValueFromRow === undefined || responseValueFromRow === null) {
        continue;
    }

    const evaluator = allStudentsFromMaster[evaluatorIdFromRow]; 
    if (!evaluator) {
        continue; 
    }

    if (!evaluator.studentId || !evaluator.studentEmail || !isValidShuEmail(evaluator.studentEmail)) {
        Logger.log(`parseRawSurveyData (V2) CRITICAL: Active Evaluator '${evaluator.studentId || evaluatorIdFromRow}' from master list has invalid/missing studentId or studentEmail ('${evaluator.studentEmail || 'undefined'}'). Skipping response for this row only.`);
        continue;
    }
    const finalEvaluatorEmailForResponse = evaluator.studentEmail; 

    let evaluatedStudent = allStudentsFromMaster[evaluatedStudentIdFromRow]; 
    if (!evaluatedStudent) {
        evaluatedStudent = createStudent({
            id: evaluatedStudentIdFromRow, 
            name: evaluatedStudentNameFromRow, 
            studentMasterListById: allStudentsFromMaster, 
            studentMasterListByName: studentMasterListByName 
        }); 
        
        if (!evaluatedStudent || !evaluatedStudent.studentId) { 
            Logger.log(`parseRawSurveyData (V2) WARNING: Failed to create/resolve placeholder for evaluated student ID '${evaluatedStudentIdFromRow}' from survey row ${i+1}. Skipping response.`);
            continue; 
        }
    }
    const finalEvaluatedStudentIdForResponse = evaluatedStudent.studentId; 
    
    if (!questionsFromConfig[questionIdFromRow]){ 
        continue; 
    }
    
    let actualResponseValue = responseValueFromRow;
    if (responseTypeFromRow === "SCORE") {
        actualResponseValue = parseFloat(responseValueFromRow);
        if (isNaN(actualResponseValue)) { 
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
    }
  } 

  Logger.log(`parseRawSurveyData (V2): Final counts - Students processed from master: ${Object.keys(allStudentsFromMaster).length}, Questions from config: ${Object.keys(questionsFromConfig).length}, Valid responses parsed: ${responsesArray.length}`);
  return { 
    students: allStudentsFromMaster, 
    questions: questionsFromConfig, 
    responses: responsesArray 
  };
}