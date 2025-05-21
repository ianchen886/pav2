/* global isValidProductionUnit, isValidShuEmail, extractStudentIdFromEmail */ 
// Logger can be here for explicitness or rely on central config

/**
 * @file Models.js
 * @description This file contains factory functions to create and validate standardized
 * data objects (Student, Question, Response) used throughout the Peer Assessment system.
 * These functions ensure data consistency and provide a common structure for assessment entities.
 *
 * @requires Utils.js (for validation helper functions like isValidProductionUnit, isValidShuEmail, etc.)
 */

// This file contains functions to create and validate Student, Question, and Response objects. // Your existing comment

/**
 * Creates a standardized Student object with validated and consolidated information.
 * It attempts to complete student details by looking up against master lists if provided,
 * deriving ID from email, or looking up by name. It also handles unit cleaning.
 *
 * @function createStudent
 * @param {object} [options={}] - Options for creating the student.
 * @param {string} [options.id] - The student's ID.
 * @param {string} [options.name] - The student's name.
 * @param {string} [options.email] - The student's email address.
 * @param {string} [options.unit1] - The student's primary production unit.
 * @param {string} [options.unit2] - The student's secondary production unit (if any).
 * @param {string} [options.status="active"] - The student's enrollment status (e.g., "active", "enrolled").
 * @param {Object<string, object>} [options.studentMasterListById] - Optional map of master student data keyed by ID.
 * @param {Object<string, object>} [options.studentMasterListByName] - Optional map of master student data keyed by name.
 * @returns {object|null} A Student object with properties (studentId, studentName, studentEmail,
 *                        productionUnit1, productionUnit2, status, isValid) or null if
 *                        essential validation (like a valid ID) fails.
 */
// createResponse is called by Parser_V2.js and MockDataGenerator.js.
// If ESLint doesn't see these usages after those files are linted with /* global ... */
// then this disable line is necessary. Try removing it after those files are
// eslint-disable-next-line no-unused-vars
function createStudent({ 
    id, name, email, unit1, unit2, status,
    studentMasterListById, studentMasterListByName 
} = {}) {
  // ... (Logger.log calls will use the Logger from eslint.config.mjs globals) ...
  // ... (isValidProductionUnit, isValidShuEmail, extractStudentIdFromEmail are from the /* global */ line above) ...
  // CURRENT CODE FOR createStudent (as you provided)
  // ...
  let studentId = id ? id.toString().trim().toUpperCase() : null;
  let studentName = name ? name.toString().trim() : ""; 
  let studentEmail = email ? email.toString().trim().toLowerCase() : "";
  let derivedIdFromEmail = "";
  
  let finalUnit1 = unit1 ? unit1.toString().trim().toUpperCase() : "";
  let finalUnit2 = unit2 ? unit2.toString().trim().toUpperCase() : "";
  let finalStatus = status ? status.toString().trim().toLowerCase() : "active";

  if (finalUnit1.startsWith("UNIT ") && finalUnit1.length > 5) finalUnit1 = finalUnit1.substring(5,6);
  if (finalUnit1 && !isValidProductionUnit(finalUnit1)) finalUnit1 = ""; 
  if (finalUnit2.startsWith("UNIT ") && finalUnit2.length > 5) finalUnit2 = finalUnit2.substring(5,6);
  if (finalUnit2 && !isValidProductionUnit(finalUnit2)) finalUnit2 = "";

  if (studentId && studentMasterListById && studentMasterListById[studentId]) {
      const masterData = studentMasterListById[studentId]; 
      studentName = studentName || (masterData.studentName ? masterData.studentName.toString().trim() : ""); 
      finalUnit1 = finalUnit1 || (masterData.productionUnit1 || ""); 
      finalUnit2 = finalUnit2 || (masterData.productionUnit2 || "");
      studentEmail = studentEmail || (masterData.studentEmail ? masterData.studentEmail.toLowerCase() : "");
      finalStatus = finalStatus || (masterData.status ? masterData.status.toLowerCase() : "active"); 
      // Logger.log(`createStudent: Used master data for ID '${studentId}'.`);
  }

  if (studentEmail && isValidShuEmail(studentEmail)) {
    derivedIdFromEmail = extractStudentIdFromEmail(studentEmail);
    if (!studentId) { 
      studentId = derivedIdFromEmail;
      if (studentMasterListById && studentMasterListById[studentId]) {
          const masterData = studentMasterListById[studentId]; 
          studentName = studentName || (masterData.studentName ? masterData.studentName.toString().trim() : "");
          finalUnit1 = finalUnit1 || (masterData.productionUnit1 || "");
          finalUnit2 = finalUnit2 || (masterData.productionUnit2 || "");
          finalStatus = finalStatus || (masterData.status ? masterData.status.toLowerCase() : "active");
          // Logger.log(`createStudent: ID '${studentId}' derived from email.`);
      }
    } else if (studentId !== derivedIdFromEmail && !studentId.startsWith("UNKNOWNID_")) { 
      Logger.log(`createStudent WARNING: Explicit Student ID '${studentId}' differs from ID '${derivedIdFromEmail}' derived from email '${email}'. Using explicit ID.`);
    }
  }

  if (!studentId && studentName && studentMasterListByName && studentMasterListByName[studentName]) {
      const masterDataForName = studentMasterListByName[studentName]; 
      if (masterDataForName && masterDataForName.studentId) { 
        studentId = masterDataForName.studentId.toUpperCase();
        finalUnit1 = finalUnit1 || (masterDataForName.productionUnit1 || "");
        finalUnit2 = finalUnit2 || (masterDataForName.productionUnit2 || "");
        studentEmail = studentEmail || (masterDataForName.studentEmail ? masterDataForName.studentEmail.toLowerCase() : "");
        finalStatus = finalStatus || (masterDataForName.status ? masterDataForName.status.toLowerCase() : "active");
        // Logger.log(`createStudent: Found ID '${studentId}' via name lookup for '${studentName}'.`);
      }
  }
  
  if (!studentName && studentId && !studentId.startsWith("UNKNOWNID_")) { 
    if (studentMasterListById && studentMasterListById[studentId] && studentMasterListById[studentId].studentName) { 
        studentName = studentMasterListById[studentId].studentName.toString().trim();
    }
    if (!studentName) { 
        studentName = `[Name for ${studentId}]`; 
    }
  }
  
   if (!studentEmail && studentId && /^[A-Z]{1}[0-9]{9}$/.test(studentId)) {
       let derivedFallbackEmail = studentId.toLowerCase() + "@mail.shu.edu.tw";
       if (isValidShuEmail(derivedFallbackEmail)) {
           studentEmail = derivedFallbackEmail;
       }
   }

  if (!studentId || (!/^[A-Z]{1}[0-9]{9}$/.test(studentId) && !studentId.startsWith("UNKNOWNID_"))) {
    Logger.log(`createStudent FAILED: Invalid or missing Student ID. Inputs: id='${id}', name='${name}', email='${email}'. Resulting ID: '${studentId}'`);
    return null;
  }
   if (!studentName && studentId) { 
    studentName = `[Name Missing for ${studentId}]`;
   }

  return {
    studentId: studentId,
    studentName: studentName,
    studentEmail: studentEmail,
    productionUnit1: finalUnit1, 
    productionUnit2: finalUnit2,
    status: finalStatus, 
    isValid: function() {
        const isActive = (this.status === "active" || this.status === "enrolled");
        const hasValidId = (/^[A-Z]{1}[0-9]{9}$/.test(this.studentId) || this.studentId.startsWith("UNKNOWNID_"));
        const hasRealName = this.studentName && !this.studentName.startsWith("[Name for") && !this.studentName.startsWith("[Name Missing for") && !this.studentName.startsWith("[NameDefaultInParserFor_");
        const hasValidEmailOrIsEmpty = (this.studentEmail === "" || isValidShuEmail(this.studentEmail) || this.studentEmail.startsWith("[NoValidEmailFor_"));
        return hasValidId && isActive && hasRealName && hasValidEmailOrIsEmpty;
    }
  };
}

/**
 * Creates a Question object with validated properties.
 *
 * @function createQuestion
 * @param {string} id - The unique ID of the question (e.g., "Q01"). Must match /^Q[0-9]{1,2}$/i.
 * @param {string} prompt - The text of the question. Must not be empty.
 * @param {string} [instructionalComment=""] - Optional instructional comment.
 * @param {string} [questionType="LikertScale"] - Type of question (e.g., "LikertScale", "ShortText").
 * @param {string} [choicesString=""] - Comma-separated string of choices for applicable types.
 * @returns {object|null} A Question object with properties (questionId, questionPrompt,
 *                        questionInstruction, questionType, choices, isValid) or null if validation fails.
 */
// createResponse is called by Parser_V2.js and MockDataGenerator.js.
// If ESLint doesn't see these usages after those files are linted with /* global ... */
// then this disable line is necessary. Try removing it after those files are
// eslint-disable-next-line no-unused-vars
function createQuestion(id, prompt, instructionalComment = "", questionType = "LikertScale", choicesString = "") {
  const idPattern = /^Q[0-9]{1,2}$/i; // Made pattern case-insensitive for robustness, though QID is uppercased
  if (typeof id !== 'string' || !idPattern.test(id.toUpperCase())) {
    Logger.log(`Invalid Question ID format for createQuestion: ${id}`);
    return null;
  }
  if (typeof prompt !== 'string' || prompt.trim() === "") { 
      Logger.log(`Question prompt must be a non-empty string for ID: ${id}`);
      return null;
  }
  // Ensure string type for optional params, default to empty string
  instructionalComment = (typeof instructionalComment === 'string') ? instructionalComment.trim() : "";
  questionType = (typeof questionType === 'string' && questionType.trim() !== "") ? questionType.trim() : "LikertScale";
  choicesString = (typeof choicesString === 'string') ? choicesString : "";


  return {
    questionId: id.toUpperCase(),
    questionPrompt: prompt.trim(),
    questionInstruction: instructionalComment, // Already trimmed
    questionType: questionType, // Already trimmed
    choices: choicesString.split(',').map(c => c.trim()).filter(c => c !== ""), 
    isValid: function() { 
        return idPattern.test(this.questionId) && // Check against original pattern logic
               this.questionPrompt !== "" &&
               this.questionType !== "";
    }
  };
}

/**
 * Creates a Response object with a unique ID and validated properties.
 *
 * @function createResponse
 * @param {string} questionId - The ID of the question this response answers.
 * @param {string|number} responseValue - The actual response content (score or text).
 * @param {string} responseByEmail - The email of the student who submitted the response.
 * @param {string} [responseType="GENERIC"] - The type of response (e.g., "SCORE", "COMMENT").
 * @param {string} [evaluatedStudentId=""] - The ID of the student being evaluated.
 * @param {string} [timestamp=""] - ISO string timestamp of the submission. Defaults to current time.
 * @param {string} [unitContext=""] - The unit context of this specific evaluation.
 * @returns {object|null} A Response object or null if essential inputs (questionId, responseByEmail) are missing.
 */
// createResponse is called by Parser_V2.js and MockDataGenerator.js.
// If ESLint doesn't see these usages after those files are linted with /* global ... */
// then this disable line is necessary. Try removing it after those files are
// eslint-disable-next-line no-unused-vars
function createResponse(questionId, responseValue, responseByEmail, responseType = "GENERIC", evaluatedStudentId = "", timestamp = "", unitContext = "") {
  if (!questionId || !responseByEmail) {
    Logger.log(`createResponse ERROR: Missing questionId or responseByEmail. QID: ${questionId}, Email: ${responseByEmail}`);
    return null;
  }
  let responderId = extractStudentIdFromEmail(responseByEmail); // From Utils.js
  let finalTimestamp = timestamp;
  if (typeof timestamp !== 'string' || timestamp.trim() === "" || !(new Date(timestamp)).getTime()) { // Check if valid date string
      finalTimestamp = new Date().toISOString();
  } else if (timestamp instanceof Date) { // If a Date object is passed
      finalTimestamp = timestamp.toISOString();
  }


  let finalUnitContext = unitContext;
  if (typeof unitContext !== 'string' || unitContext === null) { // Allow undefined to pass to default
      finalUnitContext = "";
  } else {
      finalUnitContext = unitContext.trim().toUpperCase();
  }

  // Ensure responseType is a string and uppercased, default if necessary
  responseType = (typeof responseType === 'string' && responseType.trim() !== "") ? responseType.trim().toUpperCase() : "GENERIC";
  evaluatedStudentId = (typeof evaluatedStudentId === 'string') ? evaluatedStudentId.trim().toUpperCase() : "";


  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase(); 
  const tsShort = finalTimestamp.replace(/[-:T.Z]/g, "").substring(0,14); 
  const responseId = `RESP_${tsShort}_${responderId || 'ANON'}_${evaluatedStudentId || 'NA'}_${questionId.toUpperCase()}_${responseType.substring(0,4)}_${randomSuffix}`;
  
  return {
    responseId: responseId,
    responseToQuestionId: questionId.toUpperCase(),
    responseValue: responseValue, 
    responseByStudentId: responderId ? responderId.toUpperCase() : null,
    responseType: responseType,
    evaluatedStudentId: evaluatedStudentId, 
    timestamp: finalTimestamp,
    unitContextOfEvaluation: finalUnitContext, 
    isValid: function() { 
        return this.responseToQuestionId && 
               (this.responseByStudentId || (typeof responseByEmail === 'string' && isValidShuEmail(responseByEmail))); // isValidShuEmail from Utils.js
    }
  };
}