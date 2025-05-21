// ===================================================================================
// HELPER FUNCTIONS
// ===================================================================================
function isValidShuEmail(email) {
  if (typeof email !== 'string') return false;
  const emailPattern = /^[a-z]{1}[0-9]{9}@mail\.shu\.edu\.tw$/;
  return emailPattern.test(email.toLowerCase());
}

function extractStudentIdFromEmail(email) {
  if (!isValidShuEmail(email)) return null;
  const idPart = email.split('@')[0];
  return idPart.toUpperCase(); 
}

function isValidProductionUnit(unit) {
    if (typeof unit !== 'string' || unit.length !== 1) return false; 
    return ["A", "B", "C", "D"].includes(unit.toUpperCase());
}

function calculateMedianFromArray(arr) {
  if (!arr || arr.length === 0) return 0;
  const sortedArr = arr.slice().sort((a, b) => a - b); 
  const mid = Math.floor(sortedArr.length / 2);
  if (sortedArr.length % 2 === 0) { 
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  } else { 
    return sortedArr[mid];
  }
}

function calculateMean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateStdDev(arr, mean) {
    if (!arr || arr.length < 2) return 0; 
    const n = arr.length;
    const meanToUse = (mean === undefined) ? calculateMean(arr) : mean;
    return Math.sqrt(arr.map(x => Math.pow(x - meanToUse, 2)).reduce((a, b) => a + b) / n);
}


/**
 * Reads the 'PaQuestionConfig' sheet and returns an object map of Question objects.
 * Assumes PaQuestionConfig has PascalCase headers: QuestionID, QuestionText, QuestionType, Choices, InstructionalComment.
 * @return {object} An object where keys are questionIds (e.g., "Q01") and values are the question objects. Returns empty object on error.
 */
function getQuestionDefinitions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi(); // For alerts
  Logger.log("getQuestionDefinitions: Starting to read PaQuestionConfig.");

  const configSheetName = PA_QUESTION_CONFIG_SHEET_NAME; // From Config.gs
  const sheet = ss.getSheetByName(configSheetName);
  let questionsMap = {}; // Use map for direct lookup by questionId

  if (!sheet) {
    Logger.log(`getQuestionDefinitions ERROR: Question config sheet "${configSheetName}" not found.`);
    ui.alert("Configuration Error", `The question configuration sheet named "${configSheetName}" was not found. Please create and populate it.`, ui.ButtonSet.OK);
    return questionsMap; // Return empty map
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) { // Must have header + at least one question
    Logger.log(`getQuestionDefinitions WARNING: Sheet "${configSheetName}" is empty or has only headers.`);
    ui.alert("Configuration Warning", `The question configuration sheet "${configSheetName}" appears to be empty or only has headers. No questions loaded.`, ui.ButtonSet.OK);
    return questionsMap;
  }

  const headers = data[0].map(h => h ? h.toString().trim() : ""); // Get headers, trim, handle potential nulls
  
  // Find column indices by PascalCase header names (as per your PaQuestionConfig example)
  const idColConfigIdx = headers.indexOf("QuestionID");
  const textColConfigIdx = headers.indexOf("QuestionText");
  const typeColConfigIdx = headers.indexOf("QuestionType");
  const choicesColConfigIdx = headers.indexOf("Choices");
  const instructionColConfigIdx = headers.indexOf("InstructionalComment");

  // Validate essential headers
  if (idColConfigIdx === -1 || textColConfigIdx === -1 || typeColConfigIdx === -1 ) {
    Logger.log(`getQuestionDefinitions ERROR: Required headers (QuestionID, QuestionText, QuestionType) not found in "${configSheetName}". Found headers: [${headers.join(', ')}]`);
    ui.alert("Configuration Error", `Required headers (QuestionID, QuestionText, QuestionType) missing in "${configSheetName}". Please check the sheet.`, ui.ButtonSet.OK);
    return questionsMap; // Return empty map
  }

  for (let i = 1; i < data.length; i++) { // Start from 1 to skip header row
    const row = data[i];
    const qId = row[idColConfigIdx] ? row[idColConfigIdx].toString().trim() : null;
    const qText = row[textColConfigIdx] ? row[textColConfigIdx].toString().trim() : null;
    
    if (qId && qText) { // Only proceed if ID and Text are present
      const qType = (typeColConfigIdx !== -1 && row[typeColConfigIdx]) ? row[typeColConfigIdx].toString().trim() : "LikertScale"; // Default
      const qChoices = (choicesColConfigIdx !== -1 && row[choicesColConfigIdx]) ? row[choicesColConfigIdx].toString().trim() : "";
      const qInstruction = (instructionColConfigIdx !== -1 && row[instructionColConfigIdx]) ? row[instructionColConfigIdx].toString().trim() : "";

      let questionObject = createQuestion(qId, qText, qInstruction, qType, qChoices); 
      if (questionObject && questionObject.isValid()) { // Use the isValid method if you have one
        questionsMap[questionObject.questionId] = questionObject; // Key by QID (e.g., "Q01")
      } else {
        Logger.log(`getQuestionDefinitions: Skipped creating question from row ${i+1} due to invalid data or createQuestion failure. ID='${qId}', Text='${qText}'`);
      }
    } else if (qId || qText) { // Log if one is present but not the other (potential data issue)
        Logger.log(`getQuestionDefinitions: Skipped row ${i+1} in "${configSheetName}" due to missing QuestionID or QuestionText.`);
    }
  }
  Logger.log(`getQuestionDefinitions: Loaded ${Object.keys(questionsMap).length} question definitions from "${configSheetName}".`);
  return questionsMap;
}

function testGetQuestions() {
  Logger.clear();
  const questions = getQuestionDefinitions();
  if (Object.keys(questions).length > 0) {
    Logger.log(`Successfully loaded ${Object.keys(questions).length} questions.`);
    Logger.log("Sample Question (Q01): " + JSON.stringify(questions["Q01"], null, 2));
    Logger.log("Sample Question (Last one): " + JSON.stringify(questions[Object.keys(questions).pop()], null, 2));
  } else {
    Logger.log("No questions were loaded by getQuestionDefinitions.");
  }
}

function testNewParser() {
  Logger.clear();
  const result = parseRawSurveyData(); // This now calls your new V2 parser
  if (result) {
    Logger.log(`TestNewParser Results:`);
    Logger.log(`Students Parsed (from Master List): ${Object.keys(result.students).length}`);
    Logger.log(`Questions Parsed (from Config): ${Object.keys(result.questions).length}`);
    Logger.log(`Responses Parsed (from PaRawSubmissionsV2): ${result.responses.length}`);

    if (result.responses.length > 0) {
      Logger.log("Sample of first 3 responses:");
      Logger.log(JSON.stringify(result.responses.slice(0,3), null, 2));
    }
     if (Object.keys(result.questions).length > 0) {
      Logger.log("Sample of first question (Q01 if exists):");
      Logger.log(JSON.stringify(result.questions["Q01"], null, 2));
    }
  } else {
    Logger.log("TestNewParser: parseRawSurveyData returned null or invalid.");
  }
}