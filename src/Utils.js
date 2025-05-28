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
  
  // Student format: one lowercase letter, followed by 9 digits
  const studentEmailPattern = /^[a-z]{1}[0-9]{9}@mail\.shu\.edu\.tw$/;
  
  // Faculty/staff format: letters and possibly numbers, no specific length requirement
  const facultyEmailPattern = /^[a-z][a-z0-9]*@mail\.shu\.edu\.tw$/;
  
  const lowerEmail = email.toLowerCase();
  return studentEmailPattern.test(lowerEmail) || facultyEmailPattern.test(lowerEmail);
}


/**
 * Extracts the student ID from a valid SHU email address, or creates a faculty ID
 * @param {string} email The SHU email address.
 * @returns {string|null} The uppercase student ID, faculty ID, or null if invalid format.
 */
function extractStudentIdFromEmail(email) {
  if (!isValidShuEmail(email)) return null;
  
  const idPart = email.split('@')[0];
  
  // Check if it's student format (1 letter + 9 digits)
  const studentPattern = /^[a-z]{1}[0-9]{9}$/;
  if (studentPattern.test(idPart.toLowerCase())) {
    return idPart.toUpperCase();
  }
  
  // For faculty/staff, create a special ID format
  return 'FACULTY_' + idPart.toUpperCase();
}

/**
 * Check if an email belongs to a faculty member
 * @param {string} email The email to check
 * @returns {boolean} True if faculty email format
 */
function isFacultyEmail(email) {
  if (!isValidShuEmail(email)) return false;
  
  const idPart = email.split('@')[0];
  const studentPattern = /^[a-z]{1}[0-9]{9}$/;
  
  // If it doesn't match student pattern but is valid SHU email, it's faculty
  return !studentPattern.test(idPart.toLowerCase());
}

/**
 * Updated getCurrentUserSession to handle faculty access
 */
function getCurrentUserSession() {
  Logger.log('getCurrentUserSession called');
  
  try {
    // Get the current user's email
    const userEmail = Session.getActiveUser().getEmail();
    Logger.log('Current user email: ' + userEmail);
    
    if (!userEmail) {
      throw new Error('No authenticated user found');
    }
    
    // Validate that it's a valid SHU email (student or faculty)
    if (!isValidShuEmail(userEmail)) {
      throw new Error('Access denied. Please use your SHU email account.');
    }
    
    // Extract ID from email
    const userId = extractStudentIdFromEmail(userEmail);
    if (!userId) {
      throw new Error('Could not extract user ID from email');
    }
    
    // Check if faculty
    if (isFacultyEmail(userEmail)) {
      Logger.log('Faculty user detected: ' + userId);
      
      // Return faculty session
      return {
        isAuthenticated: true,
        studentId: userId,
        studentName: 'Faculty Member',
        email: userEmail,
        productionUnit: 'FACULTY',
        unitMembers: [],
        timestamp: new Date().toISOString(),
        role: 'instructor',
        isFaculty: true
      };
    }
    
    // For students, continue with existing logic
    const studentInfo = getStudentFromMasterList(userId);
    if (!studentInfo) {
      throw new Error('Student not found in master list. Please contact your instructor.');
    }
    
    const unitMembers = getUnitMembers(studentInfo);
    
    return {
      isAuthenticated: true,
      studentId: studentInfo.studentId,
      studentName: studentInfo.studentName,
      email: userEmail,
      productionUnit: studentInfo.productionUnit1,
      unitMembers: unitMembers,
      timestamp: new Date().toISOString(),
      role: 'student',
      isFaculty: false
    };
    
  } catch (error) {
    Logger.log('Error in getCurrentUserSession: ' + error.toString());
    return {
      isAuthenticated: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
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