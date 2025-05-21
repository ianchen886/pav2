/* global PA_QUESTION_CONFIG_SHEET_NAME, createQuestion, parseRawSurveyData */

/**
 * @file Utils.js
 * @description This file contains general-purpose helper and utility functions used across
 * the Peer Assessment system. It includes functions for data validation (emails, units),
 * mathematical calculations (median, mean, standard deviation), and dedicated test functions
 * for developers to verify parts of the system.
 *
 * @requires Config.gs (for sheet name constants like PA_QUESTION_CONFIG_SHEET_NAME)
 * @requires Models.gs (for createQuestion function, if getQuestionDefinitions here is primary)
 * @requires Parser_V2.js (for parseRawSurveyData function, used in testNewParser)
 */

// ===================================================================================
// HELPER FUNCTIONS
// ===================================================================================

/**
 * Validates if the given email string matches the SHU (Shih Hsin University) student email format.
 * Expected format: one lowercase letter, followed by 9 digits, then '@mail.shu.edu.tw'.
 * @param {string} email The email string to validate.
 * @returns {boolean} True if the email is a valid SHU format, false otherwise.
 */
// // eslint-disable-next-line no-unused-vars
function isValidShuEmail(email) {
  if (typeof email !== 'string') return false;
  const emailPattern = /^[a-z]{1}[0-9]{9}@mail\.shu\.edu\.tw$/;
  return emailPattern.test(email.toLowerCase());
}

/**
 * Extracts the student ID (the part before '@') from a valid SHU email address.
 * The extracted ID is converted to uppercase.
 * @param {string} email The SHU email address.
 * @returns {string|null} The uppercase student ID, or null if the email is not a valid SHU format.
 */
// eslint-disable-next-line no-unused-vars
function extractStudentIdFromEmail(email) {
  if (!isValidShuEmail(email)) return null; // Calls local isValidShuEmail
  const idPart = email.split('@')[0];
  return idPart.toUpperCase(); 
}

/**
 * Validates if the given unit string is a valid single-letter production unit (A, B, C, or D).
 * Case-insensitive check.
 * @param {string} unit The unit string to validate.
 * @returns {boolean} True if the unit is valid, false otherwise.
 */
// eslint-disable-next-line no-unused-vars
function isValidProductionUnit(unit) {
    if (typeof unit !== 'string' || unit.length !== 1) return false; 
    return ["A", "B", "C", "D"].includes(unit.toUpperCase());
}

/**
 * Calculates the median value from an array of numbers.
 * Returns 0 if the array is empty or null.
 * @param {number[]} arr The array of numbers.
 * @returns {number} The median of the array.
 */
// eslint-disable-next-line no-unused-vars
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

/**
 * Calculates the mean (average) from an array of numbers.
 * Returns 0 if the array is empty or null.
 * @param {number[]} arr The array of numbers.
 * @returns {number} The mean of the array.
 */
// // eslint-disable-next-line no-unused-vars
function calculateMean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculates the population standard deviation from an array of numbers.
 * An optional mean can be provided; otherwise, it's calculated.
 * Returns 0 if the array has fewer than 2 elements or is null.
 * @param {number[]} arr The array of numbers.
 * @param {number} [mean] - Optional pre-calculated mean of the array.
 * @returns {number} The population standard deviation.
 */
// eslint-disable-next-line no-unused-vars
function calculateStdDev(arr, mean) {
    if (!arr || arr.length < 2) return 0; 
    const n = arr.length;
    const meanToUse = (mean === undefined) ? calculateMean(arr) : mean; // Calls local calculateMean
    return Math.sqrt(arr.map(x => Math.pow(x - meanToUse, 2)).reduce((a, b) => a + b) / n);
}

/**
 * Reads the 'PaQuestionConfig' sheet and returns an object map of Question objects.
 * This version of the function resides in Utils.js and is primarily for testing purposes via `testGetQuestions`.
 * The canonical version used by the main parser is in Parser_V2.js.
 * Assumes PaQuestionConfig has PascalCase headers: QuestionID, QuestionText, QuestionType, Choices, InstructionalComment.
 * @returns {Object<string, object>} An object where keys are questionIds (e.g., "Q01") and values are Question objects.
 *                                  Returns an empty object on error.
 */
// // eslint-disable-next-line no-unused-vars
function getQuestionDefinitions() { // This is Utils.js version
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi(); 
  Logger.log("Utils.getQuestionDefinitions: Starting to read PaQuestionConfig."); // Clarified source

  const configSheetName = PA_QUESTION_CONFIG_SHEET_NAME; 
  const sheet = ss.getSheetByName(configSheetName);
  let questionsMap = {}; 

  if (!sheet) {
    Logger.log(`Utils.getQuestionDefinitions ERROR: Question config sheet "${configSheetName}" not found.`);
    ui.alert("Configuration Error", `The question configuration sheet named "${configSheetName}" was not found. Please create and populate it.`, ui.ButtonSet.OK);
    return questionsMap; 
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) { 
    Logger.log(`Utils.getQuestionDefinitions WARNING: Sheet "${configSheetName}" is empty or has only headers.`);
    ui.alert("Configuration Warning", `The question configuration sheet "${configSheetName}" appears to be empty or only has headers. No questions loaded.`, ui.ButtonSet.OK);
    return questionsMap;
  }

  const headers = data[0].map(h => h ? h.toString().trim() : ""); 
  
  const idColConfigIdx = headers.indexOf("QuestionID");
  const textColConfigIdx = headers.indexOf("QuestionText");
  const typeColConfigIdx = headers.indexOf("QuestionType");
  const choicesColConfigIdx = headers.indexOf("Choices");
  const instructionColConfigIdx = headers.indexOf("InstructionalComment");

  if (idColConfigIdx === -1 || textColConfigIdx === -1 || typeColConfigIdx === -1 ) {
    Logger.log(`Utils.getQuestionDefinitions ERROR: Required headers (QuestionID, QuestionText, QuestionType) not found in "${configSheetName}". Found headers: [${headers.join(', ')}]`);
    ui.alert("Configuration Error", `Required headers (QuestionID, QuestionText, QuestionType) missing in "${configSheetName}". Please check the sheet.`, ui.ButtonSet.OK);
    return questionsMap; 
  }

  for (let i = 1; i < data.length; i++) { 
    const row = data[i];
    const qId = row[idColConfigIdx] ? row[idColConfigIdx].toString().trim().toUpperCase() : null; // Added toUpperCase() for consistency
    const qText = row[textColConfigIdx] ? row[textColConfigIdx].toString().trim() : null;
    
    if (qId && qText) { 
      const qType = (typeColConfigIdx !== -1 && row[typeColConfigIdx]) ? row[typeColConfigIdx].toString().trim() : "LikertScale"; 
      const qChoices = (choicesColConfigIdx !== -1 && row[choicesColConfigIdx]) ? row[choicesColConfigIdx].toString().trim() : "";
      const qInstruction = (instructionColConfigIdx !== -1 && row[instructionColConfigIdx]) ? row[instructionColConfigIdx].toString().trim() : "";

      let questionObject = createQuestion(qId, qText, qInstruction, qType, qChoices); 
      if (questionObject && questionObject.isValid()) { 
        questionsMap[questionObject.questionId] = questionObject; 
      } else {
        Logger.log(`Utils.getQuestionDefinitions: Skipped creating question from row ${i+1} due to invalid data or createQuestion failure. ID='${qId}', Text='${qText}'`);
      }
    } else if (qId || qText) { 
        Logger.log(`Utils.getQuestionDefinitions: Skipped row ${i+1} in "${configSheetName}" due to missing QuestionID or QuestionText.`);
    }
  }
  Logger.log(`Utils.getQuestionDefinitions: Loaded ${Object.keys(questionsMap).length} question definitions from "${configSheetName}".`);
  return questionsMap;
}

/**
 * Test function to load and log question definitions using the `getQuestionDefinitions`
 * function within this Utils.js file.
 * Intended for developer use via the Apps Script editor.
 * @function testGetQuestions
 */
// eslint-disable-next-line no-unused-vars
function testGetQuestions() {
  Logger.clear();
  const questions = getQuestionDefinitions(); // Calls local getQuestionDefinitions
  if (Object.keys(questions).length > 0) {
    Logger.log(`Successfully loaded ${Object.keys(questions).length} questions (using Utils.getQuestionDefinitions).`);
    Logger.log("Sample Question (Q01): " + JSON.stringify(questions["Q01"], null, 2));
    Logger.log("Sample Question (Last one): " + JSON.stringify(questions[Object.keys(questions).pop()], null, 2));
  } else {
    Logger.log("No questions were loaded by Utils.getQuestionDefinitions.");
  }
}

/**
 * Test function for the V2 parser (`parseRawSurveyData` from Parser_V2.js).
 * Logs counts of parsed students, questions, and responses, and sample data.
 * Intended for developer use via the Apps Script editor.
 * @function testNewParser
 */
// eslint-disable-next-line no-unused-vars
function testNewParser() {
  Logger.clear();
  const result = parseRawSurveyData(); // Calls parseRawSurveyData from Parser_V2.js
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