/* global PA_RAW_SUBMISSIONS_V2_SHEET_NAME, isValidShuEmail, isValidProductionUnit, validateAssessmentPermission */

/**
 * @file SubmissionHandler.js
 * @description Enhanced submission handler for the improved assessment interface
 * Handles individual and batch submissions with better validation and tracking
 */

/**
 * Enhanced submission handler that supports both individual and batch submissions
 * @param {Array} submissions - Array of submission objects from the frontend
 * @returns {Object} Result object with success status and detailed information
 */


// eslint-disable-next-line no-unused-vars 
function submitPeerAssessments(submissions) {
  try {
    Logger.log(`Received ${submissions.length} assessment submissions for processing`);
    
    // Validate input
    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      throw new Error("No valid submissions provided");
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let targetSheet = ss.getSheetByName(PA_RAW_SUBMISSIONS_V2_SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!targetSheet) {
      targetSheet = ss.insertSheet(PA_RAW_SUBMISSIONS_V2_SHEET_NAME);
      const headers = [
        "submissionId", "responseId", "timestamp", "evaluatorId", "evaluatorEmail", 
        "evaluatedStudentId", "evaluatedStudentName", "unitContextOfEvaluation", 
        "questionId", "responseType", "responseValue"
      ];
      targetSheet.appendRow(headers);
      targetSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setHorizontalAlignment("center");
      targetSheet.setFrozenRows(1);
      Logger.log(`Created new sheet: ${PA_RAW_SUBMISSIONS_V2_SHEET_NAME}`);
    }
    
    // Validate and process submissions
    const validatedSubmissions = [];
    const errors = [];
    // const submissionGroups = groupSubmissionsByEvaluatedStudent(submissions);
    
    submissions.forEach((submission, index) => {
      try {
        const validatedSubmission = validateAndFormatSubmission(submission);
        if (validatedSubmission) {
          validatedSubmissions.push(validatedSubmission);
        }
      } catch (error) {
        errors.push(`Submission ${index + 1}: ${error.message}`);
      }
    });
    
    if (errors.length > 0) {
      Logger.log(`Validation errors: ${errors.join('; ')}`);
      throw new Error(`Validation failed for ${errors.length} submissions: ${errors.join('; ')}`);
    }
    
    if (validatedSubmissions.length === 0) {
      throw new Error("No valid submissions to process after validation");
    }
    
    // Check for duplicate submissions and handle overwrites
    const existingData = getExistingSubmissions(targetSheet);
    const duplicateHandling = handleDuplicateSubmissions(validatedSubmissions, existingData);
    
    // Remove old submissions if overwriting
    if (duplicateHandling.toRemove.length > 0) {
      removeDuplicateSubmissions(targetSheet, duplicateHandling.toRemove);
      Logger.log(`Removed ${duplicateHandling.toRemove.length} duplicate submissions for overwrite`);
    }
    
    // Prepare data rows for batch insertion
    const dataRows = validatedSubmissions.map(submission => [
      submission.submissionId,
      submission.responseId,
      submission.timestamp,
      submission.evaluatorId,
      submission.evaluatorEmail,
      submission.evaluatedStudentId,
      submission.evaluatedStudentName,
      submission.unitContextOfEvaluation,
      submission.questionId,
      submission.responseType,
      submission.responseValue
    ]);
    
    // Insert all data in one batch operation for better performance
    if (dataRows.length > 0) {
      targetSheet.getRange(targetSheet.getLastRow() + 1, 1, dataRows.length, dataRows[0].length)
                 .setValues(dataRows);
      
      Logger.log(`Successfully inserted ${dataRows.length} assessment responses into ${PA_RAW_SUBMISSIONS_V2_SHEET_NAME}`);
    }
    
    // Generate detailed submission summary
    const submissionSummary = generateDetailedSubmissionSummary(validatedSubmissions);
    Logger.log(`Submission Summary: ${JSON.stringify(submissionSummary)}`);
    
    return {
      success: true,
      message: `Successfully submitted ${validatedSubmissions.length} assessment responses`,
      inserted: validatedSubmissions.length,
      overwritten: duplicateHandling.toRemove.length,
      summary: submissionSummary
    };
    
  } catch (error) {
    Logger.log(`Error in submitPeerAssessments: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Groups submissions by evaluated student for better organization
 * @param {Array} submissions - Array of submission objects
 * @returns {Object} Object with evaluated student IDs as keys
 */

// eslint-disable-next-line no-unused-vars
function groupSubmissionsByEvaluatedStudent(submissions) {
  const groups = {};
  
  submissions.forEach(submission => {
    const evaluatedId = submission.evaluatedStudentId;
    if (!groups[evaluatedId]) {
      groups[evaluatedId] = {
        evaluatedStudentId: evaluatedId,
        evaluatedStudentName: submission.evaluatedStudentName,
        submissions: []
      };
    }
    groups[evaluatedId].submissions.push(submission);
  });
  
  return groups;
}

/**
 * Enhanced validation function with better error messages
 * @param {Object} submission - Raw submission from frontend
 * @returns {Object} Validated and formatted submission
 */
function validateAndFormatSubmission(submission) {
  // Required fields validation
  const requiredFields = [
    'submissionId', 'evaluatorId', 'evaluatorEmail', 'evaluatedStudentId',
    'questionId', 'responseType', 'responseValue'
  ];
  
  for (const field of requiredFields) {
    if (!submission[field] && submission[field] !== 0) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Enhanced email validation
  if (!isValidShuEmail(submission.evaluatorEmail)) {
    throw new Error(`Invalid evaluator email format: ${submission.evaluatorEmail}. Must be SHU format (e.g., x123456789@mail.shu.edu.tw)`);
  }
  
  // Enhanced student ID validation
  const studentIdPattern = /^[A-Z]{1}[0-9]{9}$/;
  if (!studentIdPattern.test(submission.evaluatorId)) {
    throw new Error(`Invalid evaluator ID format: ${submission.evaluatorId}. Must be 1 letter + 9 digits (e.g., S123456789)`);
  }
  if (!studentIdPattern.test(submission.evaluatedStudentId)) {
    throw new Error(`Invalid evaluated student ID format: ${submission.evaluatedStudentId}. Must be 1 letter + 9 digits`);
  }
  
  // Enhanced response type validation
  const validResponseTypes = ['SCORE', 'COMMENT'];
  if (!validResponseTypes.includes(submission.responseType.toUpperCase())) {
    throw new Error(`Invalid response type: ${submission.responseType}. Must be 'SCORE' or 'COMMENT'`);
  }
  
  // Enhanced score validation
  if (submission.responseType.toUpperCase() === 'SCORE') {
    const score = Number(submission.responseValue);
    if (isNaN(score) || score < 1 || score > 5) {
      throw new Error(`Invalid score value: ${submission.responseValue}. Must be between 1-5`);
    }
    submission.responseValue = score;
  }
  
  // Enhanced comment validation
  if (submission.responseType.toUpperCase() === 'COMMENT') {
    if (typeof submission.responseValue !== 'string' || submission.responseValue.trim() === '') {
      throw new Error(`Invalid comment value: must be non-empty string`);
    }
    submission.responseValue = submission.responseValue.trim();
    
    // Optional: Check comment length
    if (submission.responseValue.length > 1000) {
      throw new Error(`Comment too long: ${submission.responseValue.length} characters. Maximum 1000 characters allowed`);
    }
  }
  
  // Validate unit context
  if (submission.unitContextOfEvaluation && 
      !isValidProductionUnit(submission.unitContextOfEvaluation)) {
    throw new Error(`Invalid unit context: ${submission.unitContextOfEvaluation}. Must be A, B, C, or D`);
  }
  
  // Validate assessment permission
  if (!validateAssessmentPermission(submission.evaluatorId, submission.evaluatedStudentId)) {
    throw new Error(`Assessment not permitted: ${submission.evaluatorId} cannot evaluate ${submission.evaluatedStudentId} (not in same unit)`);
  }
  
  // Generate unique response ID
  const timestamp = submission.timestamp || new Date().toISOString();
  const responseId = generateResponseId(submission, timestamp);
  
  return {
    submissionId: submission.submissionId.toString().trim(),
    responseId: responseId,
    timestamp: timestamp,
    evaluatorId: submission.evaluatorId.toString().trim().toUpperCase(),
    evaluatorEmail: submission.evaluatorEmail.toString().trim().toLowerCase(),
    evaluatedStudentId: submission.evaluatedStudentId.toString().trim().toUpperCase(),
    evaluatedStudentName: submission.evaluatedStudentName || `[Name for ${submission.evaluatedStudentId}]`,
    unitContextOfEvaluation: submission.unitContextOfEvaluation || '',
    questionId: submission.questionId.toString().trim().toUpperCase(),
    responseType: submission.responseType.toString().trim().toUpperCase(),
    responseValue: submission.responseValue
  };
}

/**
 * Enhanced duplicate handling with overwrite capability
 * @param {Array} newSubmissions - New submissions to check
 * @param {Array} existingSubmissions - Existing submissions in sheet
 * @returns {Object} Object with duplicates and items to remove
 */
function handleDuplicateSubmissions(newSubmissions, existingSubmissions) {
  const duplicates = [];
  const toRemove = [];
  
  newSubmissions.forEach(newSub => {
    const duplicateIndex = existingSubmissions.findIndex(existing => 
      existing.evaluatorId === newSub.evaluatorId &&
      existing.evaluatedStudentId === newSub.evaluatedStudentId &&
      existing.questionId === newSub.questionId &&
      existing.responseType === newSub.responseType
    );
    
    if (duplicateIndex !== -1) {
      const duplicate = existingSubmissions[duplicateIndex];
      duplicates.push({
        new: newSub,
        existing: duplicate
      });
      
      // Mark for removal (will be overwritten)
      toRemove.push({
        rowIndex: duplicateIndex + 2, // +2 because array is 0-indexed and sheet has header
        submission: duplicate
      });
    }
  });
  
  return { duplicates, toRemove };
}

/**
 * Remove duplicate submissions from sheet
 * @param {Sheet} sheet - The target sheet
 * @param {Array} toRemove - Array of items to remove
 */
function removeDuplicateSubmissions(sheet, toRemove) {
  // Sort by row index in descending order to avoid index shifting
  toRemove.sort((a, b) => b.rowIndex - a.rowIndex);
  
  toRemove.forEach(item => {
    try {
      sheet.deleteRow(item.rowIndex);
    } catch (error) {
      Logger.log(`Error removing duplicate row ${item.rowIndex}: ${error.message}`);
    }
  });
}

/**
 * Generates a detailed submission summary
 * @param {Array} submissions - Array of validated submissions
 * @param {Object} submissionGroups - Grouped submissions by evaluated student
 * @returns {Object} Detailed summary object
 */
function generateDetailedSubmissionSummary(submissions) {
  const summary = {
    totalSubmissions: submissions.length,
    scoreSubmissions: 0,
    commentSubmissions: 0,
    evaluators: new Set(),
    evaluatedStudents: new Set(),
    questions: new Set(),
    units: new Set(),
    submissionsByStudent: {},
    completedAssessments: []
  };
  
  submissions.forEach(sub => {
    if (sub.responseType === 'SCORE') summary.scoreSubmissions++;
    if (sub.responseType === 'COMMENT') summary.commentSubmissions++;
    
    summary.evaluators.add(sub.evaluatorId);
    summary.evaluatedStudents.add(sub.evaluatedStudentId);
    summary.questions.add(sub.questionId);
    if (sub.unitContextOfEvaluation) summary.units.add(sub.unitContextOfEvaluation);
    
    // Track submissions by student
    if (!summary.submissionsByStudent[sub.evaluatedStudentId]) {
      summary.submissionsByStudent[sub.evaluatedStudentId] = {
        studentId: sub.evaluatedStudentId,
        studentName: sub.evaluatedStudentName,
        scores: 0,
        comments: 0,
        questions: new Set()
      };
    }
    
    const studentSummary = summary.submissionsByStudent[sub.evaluatedStudentId];
    if (sub.responseType === 'SCORE') {
      studentSummary.scores++;
      studentSummary.questions.add(sub.questionId);
    }
    if (sub.responseType === 'COMMENT') {
      studentSummary.comments++;
    }
  });
  
  // Identify completed assessments
  Object.values(summary.submissionsByStudent).forEach(studentSummary => {
    summary.completedAssessments.push({
      studentId: studentSummary.studentId,
      studentName: studentSummary.studentName,
      questionsCompleted: studentSummary.questions.size,
      totalScores: studentSummary.scores,
      totalComments: studentSummary.comments
    });
  });
  
  return {
    totalSubmissions: summary.totalSubmissions,
    scoreSubmissions: summary.scoreSubmissions,
    commentSubmissions: summary.commentSubmissions,
    uniqueEvaluators: summary.evaluators.size,
    uniqueEvaluatedStudents: summary.evaluatedStudents.size,
    uniqueQuestions: summary.questions.size,
    uniqueUnits: summary.units.size,
    completedAssessments: summary.completedAssessments
  };
}

/**
 * Enhanced response ID generation with better uniqueness
 * @param {Object} submission - Submission object
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Unique response ID
 */
function generateResponseId(submission, timestamp) {
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const tsShort = timestamp.replace(/[-:T.Z]/g, "").substring(0, 14);
  const responseType = submission.responseType.substring(0, 4);
  
  return `RESP_${tsShort}_${submission.evaluatorId}_${submission.evaluatedStudentId}_${submission.questionId}_${responseType}_${randomSuffix}`;
}

/**
 * Enhanced function to get existing submissions with better performance
 * @param {Sheet} sheet - The target sheet
 * @returns {Array} Array of existing submission objects
 */
function getExistingSubmissions(sheet) {
  try {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers or empty
    
    const headers = data[0];
    const existingSubmissions = [];
    
    // Create header index map for better performance
    const headerMap = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const submission = {};
      
      // Only extract the fields we need for duplicate detection
      submission.evaluatorId = row[headerMap.evaluatorId];
      submission.evaluatedStudentId = row[headerMap.evaluatedStudentId];
      submission.questionId = row[headerMap.questionId];
      submission.responseType = row[headerMap.responseType];
      submission.timestamp = row[headerMap.timestamp];
      
      existingSubmissions.push(submission);
    }
    
    return existingSubmissions;
  } catch (error) {
    Logger.log(`Error getting existing submissions: ${error.message}`);
    return [];
  }
}

/**
 * Get assessment completion status for a specific evaluator
 * @param {string} evaluatorId - Student ID of evaluator
 * @returns {Object} Completion status object
 */

// eslint-disable-next-line no-unused-vars 
function getAssessmentCompletionStatus(evaluatorId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PA_RAW_SUBMISSIONS_V2_SHEET_NAME);
    
    if (!sheet) {
      return { error: "Submissions sheet not found" };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { completedAssessments: [], totalSubmissions: 0 };
    }
    
    const headers = data[0];
    const evaluatorIdColIdx = headers.indexOf("evaluatorId");
    const evaluatedStudentIdColIdx = headers.indexOf("evaluatedStudentId");
    const questionIdColIdx = headers.indexOf("questionId");
    const responseTypeColIdx = headers.indexOf("responseType");
    
    if (evaluatorIdColIdx === -1 || evaluatedStudentIdColIdx === -1) {
      return { error: "Required columns not found" };
    }
    
    const completedAssessments = {};
    let totalSubmissions = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[evaluatorIdColIdx] === evaluatorId) {
        totalSubmissions++;
        
        const evaluatedId = row[evaluatedStudentIdColIdx];
        const questionId = row[questionIdColIdx];
        const responseType = row[responseTypeColIdx];
        
        if (!completedAssessments[evaluatedId]) {
          completedAssessments[evaluatedId] = {
            studentId: evaluatedId,
            questions: new Set(),
            scores: 0,
            comments: 0
          };
        }
        
        if (responseType === 'SCORE') {
          completedAssessments[evaluatedId].questions.add(questionId);
          completedAssessments[evaluatedId].scores++;
        } else if (responseType === 'COMMENT') {
          completedAssessments[evaluatedId].comments++;
        }
      }
    }
    
    // Convert to array format
    const completedArray = Object.values(completedAssessments).map(assessment => ({
      studentId: assessment.studentId,
      questionsCompleted: assessment.questions.size,
      totalScores: assessment.scores,
      totalComments: assessment.comments
    }));
    
    return {
      completedAssessments: completedArray,
      totalSubmissions,
      evaluatorId
    };
    
  } catch (error) {
    Logger.log(`Error getting completion status: ${error.message}`);
    return { error: error.message };
  }
}