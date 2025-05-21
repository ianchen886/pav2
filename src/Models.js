function createStudent({ 
    id, name, email, unit1, unit2, status,
    studentMasterListById, studentMasterListByName 
} = {}) {
  
  // Logger.log(`createStudent INPUTS: id='${id}', name='${name}', email='${email}', unit1='${unit1}', unit2='${unit2}', status='${status}'`);

  let studentId = id ? id.toString().trim().toUpperCase() : null;
  let studentName = name ? name.toString().trim() : ""; 
  let studentEmail = email ? email.toString().trim().toLowerCase() : "";
  let derivedIdFromEmail = "";
  
  let finalUnit1 = unit1 ? unit1.toString().trim().toUpperCase() : "";
  let finalUnit2 = unit2 ? unit2.toString().trim().toUpperCase() : "";
  let finalStatus = status ? status.toString().trim().toLowerCase() : "active";

  // Clean initial units (if provided directly to createStudent)
  if (finalUnit1.startsWith("UNIT ") && finalUnit1.length > 5) finalUnit1 = finalUnit1.substring(5,6);
  if (finalUnit1 && !isValidProductionUnit(finalUnit1)) finalUnit1 = ""; // Check if still valid after potential substring
  if (finalUnit2.startsWith("UNIT ") && finalUnit2.length > 5) finalUnit2 = finalUnit2.substring(5,6);
  if (finalUnit2 && !isValidProductionUnit(finalUnit2)) finalUnit2 = "";


  // --- Logic to consolidate and complete student information ---

  // 1. If an explicit studentId is provided, try to use it to fetch master data
  if (studentId && studentMasterListById && studentMasterListById[studentId]) {
      const masterData = studentMasterListById[studentId]; // masterData is { studentId, studentName, studentEmail, productionUnit1, ... }
      studentName = studentName || (masterData.studentName ? masterData.studentName.toString().trim() : ""); 
      finalUnit1 = finalUnit1 || (masterData.productionUnit1 || ""); 
      finalUnit2 = finalUnit2 || (masterData.productionUnit2 || "");
      studentEmail = studentEmail || (masterData.studentEmail ? masterData.studentEmail.toLowerCase() : "");
      finalStatus = finalStatus || (masterData.status ? masterData.status.toLowerCase() : "active"); // 'status' key is consistent
      // Logger.log(`createStudent: Used master data for explicitly passed ID '${studentId}'. Name='${studentName}', Email='${studentEmail}', Unit1='${finalUnit1}', Status='${finalStatus}'`);
  }

  // 2. If studentEmail is provided, try to derive ID and complete info
  if (studentEmail && isValidShuEmail(studentEmail)) {
    derivedIdFromEmail = extractStudentIdFromEmail(studentEmail);
    if (!studentId) { 
      studentId = derivedIdFromEmail;
      if (studentMasterListById && studentMasterListById[studentId]) {
          const masterData = studentMasterListById[studentId]; // masterData is { studentId, studentName, studentEmail, productionUnit1, ... }
          studentName = studentName || (masterData.studentName ? masterData.studentName.toString().trim() : "");
          finalUnit1 = finalUnit1 || (masterData.productionUnit1 || "");
          finalUnit2 = finalUnit2 || (masterData.productionUnit2 || "");
          // studentEmail is already set and validated
          finalStatus = finalStatus || (masterData.status ? masterData.status.toLowerCase() : "active");
          // Logger.log(`createStudent: ID '${studentId}' derived from email. Fetched details: Name='${studentName}', Unit1='${finalUnit1}', Status='${finalStatus}'`);
      } else if (studentId) {
          // Logger.log(`createStudent: ID '${studentId}' derived from email, but no matching entry in studentMasterListById. Name='${studentName}' (from input or blank)`);
      }
    } else if (studentId !== derivedIdFromEmail && !studentId.startsWith("UNKNOWNID_")) { 
      Logger.log(`createStudent WARNING: Explicit Student ID '${studentId}' (for input name: '${name}') differs from ID '${derivedIdFromEmail}' derived from (input email: '${email}'). Using explicit ID: '${studentId}'.`);
    }
  }

  // 3. If studentId is STILL missing, but we have a studentName, try to look up by name
  if (!studentId && studentName && studentMasterListByName && studentMasterListByName[studentName]) {
      const masterDataForName = studentMasterListByName[studentName]; // masterDataForName is { studentId, studentName, studentEmail, productionUnit1, ... }
      if (masterDataForName && masterDataForName.studentId) { // Check .studentId
        studentId = masterDataForName.studentId.toUpperCase();
        // studentName is already set if this lookup worked.
        // Ensure other details are consistent or filled
        finalUnit1 = finalUnit1 || (masterDataForName.productionUnit1 || "");
        finalUnit2 = finalUnit2 || (masterDataForName.productionUnit2 || "");
        studentEmail = studentEmail || (masterDataForName.studentEmail ? masterDataForName.studentEmail.toLowerCase() : "");
        finalStatus = finalStatus || (masterDataForName.status ? masterDataForName.status.toLowerCase() : "active");
        // Logger.log(`createStudent: Found ID '${studentId}' via name lookup for '${studentName}'.`);
      }
  }
  
  // --- Final Fallbacks and Validation ---

  // Fallback for name if still blank but ID is known (and not placeholder)
  if (!studentName && studentId && !studentId.startsWith("UNKNOWNID_")) { 
    if (studentMasterListById && studentMasterListById[studentId] && studentMasterListById[studentId].studentName) { // Check .studentName
        studentName = studentMasterListById[studentId].studentName.toString().trim();
    }
    if (!studentName) { 
        studentName = `[Name for ${studentId}]`; 
        // Logger.log(`createStudent: Name not found for ID '${studentId}', using placeholder: '${studentName}'`);
    }
  }
  
   if (!studentEmail && studentId && /^[A-Z]{1}[0-9]{9}$/.test(studentId)) {
       let derivedFallbackEmail = studentId.toLowerCase() + "@mail.shu.edu.tw";
       if (isValidShuEmail(derivedFallbackEmail)) {
           studentEmail = derivedFallbackEmail;
           // Logger.log(`createStudent: Email derived from valid SHU ID '${studentId}': '${studentEmail}'`);
       }
   }

  if (!studentId || (!/^[A-Z]{1}[0-9]{9}$/.test(studentId) && !studentId.startsWith("UNKNOWNID_"))) {
    Logger.log(`createStudent FAILED: Final check - Invalid or missing Student ID. Original inputs: id='${id}', name='${name}', email='${email}' Resulting ID: '${studentId}'`);
    return null;
  }
   if (!studentName && studentId) { 
    studentName = `[Name Missing for ${studentId}]`;
    // Logger.log(`createStudent: Name not found for ID '${studentId}', using placeholder: '${studentName}'`);
   }

  // Logger.log(`createStudent OUTPUT: studentId='${studentId}', studentName='${studentName}', studentEmail='${studentEmail}', productionUnit1='${finalUnit1}', productionUnit2='${finalUnit2}', status='${finalStatus}'`);
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
        // A more robust check for placeholder names might be needed if they can vary
        const hasRealName = this.studentName && !this.studentName.startsWith("[Name for") && !this.studentName.startsWith("[Name Missing for") && !this.studentName.startsWith("[NameDefaultInParserFor_");
        const hasValidEmailOrIsEmpty = (this.studentEmail === "" || isValidShuEmail(this.studentEmail) || this.studentEmail.startsWith("[NoValidEmailFor_")); // Allow placeholder email
        
        // Modify as needed for your definition of "valid" for a student object.
        // For example, an evaluator probably needs a real name and valid email.
        // An evaluated student might be okay with placeholders if ID is known.
        return hasValidId && isActive; // Basic validity: has ID and is active. Other checks can be contextual.
    }
  };
}

/**
 * Creates a Question object.
 * @param {string} id - The unique ID of the question (e.g., "Q01").
 * @param {string} prompt - The text of the question.
 * @param {string} [instructionalComment=""] - An optional instructional comment or hint for the question.
 * @param {string} [questionType="LikertScale"] - The type of the question (e.g., "LikertScale", "ShortText").
 * @param {string} [choicesString=""] - Comma-separated string of choices, if applicable (e.g., "1,2,3,4,5").
 * @return {object|null} The question object or null if invalid.
 */
function createQuestion(id, prompt, instructionalComment = "", questionType = "LikertScale", choicesString = "") {
  const idPattern = /^Q[0-9]{1,2}$/; 
  if (typeof id !== 'string' || !idPattern.test(id.toUpperCase())) {
    Logger.log(`Invalid Question ID format for createQuestion: ${id}`);
    return null;
  }
  if (typeof prompt !== 'string' || prompt.trim() === "") { 
      Logger.log(`Question prompt must be a non-empty string for ID: ${id}`);
      return null;
  }
  if (typeof instructionalComment !== 'string' || instructionalComment === null || instructionalComment === undefined) {
      instructionalComment = "";
  }
  if (typeof questionType !== 'string' || questionType.trim() === "") {
      questionType = "LikertScale"; // Default type
  }
  if (typeof choicesString !== 'string' || choicesString === null || choicesString === undefined) {
      choicesString = "";
  }

  return {
    questionId: id.toUpperCase(),
    questionPrompt: prompt.trim(),
    questionInstruction: instructionalComment.trim(),
    questionType: questionType.trim(), // Added
    choices: choicesString.split(',').map(c => c.trim()).filter(c => c !== ""), // Added as an array
    isValid: function() { 
        return /^Q[0-9]{1,2}$/.test(this.questionId) && 
               this.questionPrompt !== "" &&
               this.questionType !== "";
    }
  };
}



function createResponse(questionId, responseValue, responseByEmail, responseType = "GENERIC", evaluatedStudentId = "", timestamp = "", unitContext = "") {
  if (!questionId || !responseByEmail) {
    Logger.log(`createResponse ERROR: Missing questionId or responseByEmail. QID: ${questionId}, Email: ${responseByEmail}`);
    return null;
  }
  let responderId = extractStudentIdFromEmail(responseByEmail);
  let finalTimestamp = timestamp;
  if (typeof timestamp !== 'string' || timestamp.trim() === "") {
      finalTimestamp = new Date().toISOString();
  }
  let finalUnitContext = unitContext;
  if (typeof unitContext !== 'string' || unitContext === null || unitContext === undefined) {
      finalUnitContext = "";
  } else {
      finalUnitContext = unitContext.trim().toUpperCase();
  }
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase(); 
  const tsShort = finalTimestamp.replace(/[-:T\.Z]/g, "").substring(0,14); 
  const responseId = `RESP_${tsShort}_${responderId || 'ANON'}_${evaluatedStudentId || 'NA'}_${questionId}_${responseType.substring(0,4)}_${randomSuffix}`;
  return {
    responseId: responseId,
    responseToQuestionId: questionId.toUpperCase(),
    responseValue: responseValue, 
    responseByStudentId: responderId ? responderId.toUpperCase() : null,
    responseType: responseType.toUpperCase(),
    evaluatedStudentId: evaluatedStudentId ? evaluatedStudentId.toUpperCase().trim() : null, 
    timestamp: finalTimestamp,
    unitContextOfEvaluation: finalUnitContext, 
    isValid: function() { 
        return this.responseToQuestionId && 
               (this.responseByStudentId || (responseByEmail && isValidShuEmail(responseByEmail))); 
    }
  };
}