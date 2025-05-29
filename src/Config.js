/* eslint-disable no-unused-vars */

/**
 * @file Config.js
 * @description This file defines global constants and core validation functions for the 
 * Peer Assessment system. By placing validation functions here, we eliminate circular 
 * dependencies between files. This file must be loaded FIRST in clasp.json.
 */

// ===================================================================================
// SHEET NAME CONSTANTS
// ===================================================================================

const PA_QUESTION_CONFIG_SHEET_NAME = "PaQuestionConfig";
const PA_MASTER_STUDENT_LIST_SHEET_NAME = "PaMasterStudentList";
const PA_RAW_SUBMISSIONS_V2_SHEET_NAME = "PaRawSubmissionsV2"; // For new data (future web app submissions)
const PA_RAW_SUBMISSIONS_V1_SHEET_NAME = "PaRawSubmissionsV1"; // For old format data or testing
const PA_EVALUATOR_ANALYTICS_SHEET_NAME = "PaEvaluatorAnalytics";
const PA_FINAL_SCORES_SUMMARY_SHEET_NAME = "PaFinalScoresSummary";
const PA_REPORT_ALL_RESPONSES_SHEET_NAME = "PaReportAllResponses";
const PA_REPORT_MISSING_ASSESSMENTS_SHEET_NAME = "PaReportMissingAssessments";
const PA_VERIFICATION_MISSING_ASSESSMENTS_SHEET_NAME = "PaVerificationMissingAssessments";

// ===================================================================================
// CORE VALIDATION FUNCTIONS
// These are defined here to avoid circular dependencies between files
// ===================================================================================

/**
 * Validates if the given email string matches the SHU (Shih Hsin University) email format.
 * Expected formats:
 * - Student: one lowercase letter, followed by 9 digits, then '@mail.shu.edu.tw'
 * - Faculty: letters and possibly numbers, then '@mail.shu.edu.tw'
 * @param {string} email The email string to validate.
 * @returns {boolean} True if the email is a valid SHU format, false otherwise.
 */
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
 * Validates if the given unit string is a valid single-letter production unit (A, B, C, or D).
 * Case-insensitive check.
 * @param {string} unit The unit string to validate.
 * @returns {boolean} True if the unit is valid, false otherwise.
 */
function isValidProductionUnit(unit) {
    if (typeof unit !== 'string' || unit.length !== 1) return false; 
    return ["A", "B", "C", "D"].includes(unit.toUpperCase());
}

// ===================================================================================
// MATHEMATICAL UTILITY FUNCTIONS
// These are also defined here to avoid dependencies
// ===================================================================================

/**
 * Calculates the median value from an array of numbers.
 * Returns 0 if the array is empty or null.
 * @param {number[]} arr The array of numbers.
 * @returns {number} The median of the array.
 */
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
function calculateStdDev(arr, mean) {
    if (!arr || arr.length < 2) return 0; 
    const n = arr.length;
    const meanToUse = (mean === undefined) ? calculateMean(arr) : mean;
    return Math.sqrt(arr.map(x => Math.pow(x - meanToUse, 2)).reduce((a, b) => a + b) / n);
}

// ===================================================================================
// INSTRUCTOR CHECK FUNCTION
// Defined here to be available to AuthHandler without circular dependencies
// ===================================================================================

/**
 * Enhanced instructor check with configurable instructor list
 * @param {string} email - Email address to check
 * @returns {boolean} True if instructor, false otherwise
 */
function checkIfInstructor(email) {
  const instructorEmails = [
    'ichen@mail.shu.edu.tw',
    // Add more instructor emails here as needed
    // 'instructor2@mail.shu.edu.tw',
    // 'admin@mail.shu.edu.tw'
  ];
  
  const isInstructor = instructorEmails.includes(email.toLowerCase());
  Logger.log(`Instructor check for ${email}: ${isInstructor}`);
  return isInstructor;
}

// ===================================================================================
// SAFE SYSTEM STATISTICS FUNCTION
// Defined here to avoid UI dependency issues
// ===================================================================================

/**
 * Get system statistics safely without UI calls
 * This version prevents the "ss.getUi is not a function" error
 */
function getSystemStatisticsSafe() {
  try {
    Logger.log('getSystemStatisticsSafe: Starting safe statistics calculation');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Count students safely
    let totalStudents = 0;
    const studentSheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    if (studentSheet) {
      const studentData = studentSheet.getDataRange().getValues();
      if (studentData.length > 1) {
        const headers = studentData[0].map(h => h ? h.toString().trim() : "");
        const statusIdx = headers.indexOf("status");
        
        if (statusIdx !== -1) {
          for (let i = 1; i < studentData.length; i++) {
            const status = studentData[i][statusIdx] ? studentData[i][statusIdx].toString().toLowerCase() : "";
            if (status === "active" || status === "enrolled") {
              totalStudents++;
            }
          }
        } else {
          totalStudents = studentData.length - 1; // Assume all are active if no status column
        }
      }
    }
    
    // Count questions safely
    let totalQuestions = 0;
    const questionSheet = ss.getSheetByName(PA_QUESTION_CONFIG_SHEET_NAME);
    if (questionSheet) {
      const questionData = questionSheet.getDataRange().getValues();
      if (questionData.length > 1) {
        totalQuestions = questionData.length - 1;
      }
    }
    
    // Count responses safely
    let totalResponses = 0;
    const responseSheet = ss.getSheetByName(PA_RAW_SUBMISSIONS_V2_SHEET_NAME);
    if (responseSheet) {
      const responseData = responseSheet.getDataRange().getValues();
      if (responseData.length > 1) {
        totalResponses = responseData.length - 1;
      }
    }
    
    // Calculate completion rate safely
    let completionRate = 0;
    if (totalStudents > 1 && totalQuestions > 0) {
      const expectedResponses = totalStudents * totalQuestions * (totalStudents - 1);
      completionRate = expectedResponses > 0 ? Math.round((totalResponses / expectedResponses) * 100) : 0;
    }
    
    const result = {
      totalStudents,
      totalQuestions,
      totalResponses,
      completionRate: Math.min(Math.max(completionRate, 0), 100),
      lastUpdated: new Date().toISOString()
    };
    
    Logger.log(`Safe statistics calculated: ${JSON.stringify(result)}`);
    return result;
    
  } catch (error) {
    Logger.log(`Error in getSystemStatisticsSafe: ${error.message}`);
    
    // Return safe defaults instead of crashing
    return { 
      totalStudents: 0, 
      totalQuestions: 0, 
      totalResponses: 0,
      completionRate: 0,
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

// ===================================================================================
// DEPRECATION NOTICES
// For functions that were moved here from other files
// ===================================================================================

/**
 * @deprecated This function has been moved to Config.js
 * Use the version in Config.js instead to avoid circular dependencies
 */
function getSystemStatistics() {
  Logger.log('getSystemStatistics called - using safe version');
  return getSystemStatisticsSafe();
}