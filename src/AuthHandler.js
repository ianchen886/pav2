/* global isValidShuEmail, checkIfInstructor, PA_MASTER_STUDENT_LIST_SHEET_NAME, isValidProductionUnit */

/**
 * @file AuthHandler.js
 * @description Enhanced authentication system with improved session management
 * and role-based access control for the peer assessment system
 * 
 * @requires Config.js (must be loaded first - contains validation functions and constants)
 * 
 * IMPORTANT: This file does NOT need global declarations because Config.js 
 * is loaded first and makes all validation functions available globally.
 */

/**
 * Gets the current user's session information with enhanced error handling
 * This is the main authentication function that everything should call
 * @returns {Object} User session object with authentication details
 */
function getCurrentUserSession() {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      throw new Error("No authenticated user found. Please make sure you're logged in with your Google account.");
    }
    
    Logger.log(`Authentication attempt for email: ${email}`);
    
    // Enhanced email validation for SHU domain
    // isValidShuEmail is available from Config.js
    if (!isValidShuEmail(email)) {
      throw new Error(`Invalid email domain. Please use your SHU email address (format: x123456789@mail.shu.edu.tw). Current email: ${email}`);
    }
    
    // Check if user is an instructor
    // checkIfInstructor is available from Config.js
    const isInstructor = checkIfInstructor(email);
    
    // If student, get their details from master list
    let studentDetails = null;
    let productionUnit = null;
    let unitMembers = null;
    
    if (!isInstructor) {
      studentDetails = getStudentDetailsByEmail(email);
      if (!studentDetails) {
        throw new Error(`Student not found in master list or not active. Email: ${email}. Please contact your instructor to ensure you're registered for this course.`);
      }
      
      productionUnit = studentDetails.productionUnit1;
      
      // Get unit members (excluding current student)
      if (productionUnit) {
        unitMembers = getUnitMembers(productionUnit, studentDetails.studentId);
        Logger.log(`Found ${unitMembers.length} unit members for ${studentDetails.studentId} in unit ${productionUnit}`);
      } else {
        Logger.log(`Warning: No production unit assigned to student ${studentDetails.studentId}`);
      }
    } else {
      Logger.log(`Instructor access granted for: ${email}`);
      // Get all students for faculty
      unitMembers = getAllActiveStudentsForFaculty();
    }
    
    return {
      email: email,
      isAuthenticated: true,
      role: isInstructor ? 'instructor' : 'student',
      studentId: studentDetails ? studentDetails.studentId : ('FACULTY_' + email.split('@')[0].toUpperCase()),
      studentName: studentDetails ? studentDetails.studentName : 'Faculty Member',
      productionUnit: productionUnit || 'FACULTY',
      unitMembers: unitMembers || [],
      timestamp: new Date().toISOString(),
      isFaculty: isInstructor,
      sessionData: {
        totalPeersToEvaluate: unitMembers ? unitMembers.length : 0,
        hasValidUnit: !!productionUnit,
        canSubmitAssessments: !!studentDetails && !!productionUnit && unitMembers && unitMembers.length > 0
      }
    };
    
  } catch (error) {
    Logger.log(`Authentication error: ${error.message}`);
    return {
      isAuthenticated: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      email: null,
      role: null
    };
  }
}

/**
 * Enhanced student lookup with better error reporting
 * @param {string} email - Student email address
 * @returns {Object|null} Student object or null if not found
 */
function getStudentDetailsByEmail(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // PA_MASTER_STUDENT_LIST_SHEET_NAME is available from Config.js
    const sheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    
    if (!sheet) {
      Logger.log(`Master student list sheet "${PA_MASTER_STUDENT_LIST_SHEET_NAME}" not found`);
      throw new Error("Student database not found. Please contact your instructor.");
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log("No student data found in master list");
      throw new Error("Student database is empty. Please contact your instructor.");
    }
    
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    Logger.log(`Master list headers: ${headers.join(', ')}`);
    
    const emailColIdx = headers.indexOf("email");
    const idColIdx = headers.indexOf("studentId");
    const nameColIdx = headers.indexOf("studentName");
    const unit1ColIdx = headers.indexOf("unit1");
    const unit2ColIdx = headers.indexOf("unit2");
    const statusColIdx = headers.indexOf("status");
    
    if (emailColIdx === -1 || idColIdx === -1 || nameColIdx === -1 || statusColIdx === -1) {
      Logger.log(`Required columns not found. Email: ${emailColIdx}, ID: ${idColIdx}, Name: ${nameColIdx}, Status: ${statusColIdx}`);
      throw new Error("Student database format error. Please contact your instructor.");
    }
    
    // Search for student
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentEmail = row[emailColIdx] ? row[emailColIdx].toString().trim().toLowerCase() : "";
      const status = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : "";
      
      if (studentEmail === email.toLowerCase()) {
        // Check if student is active
        if (status !== "active" && status !== "enrolled") {
          Logger.log(`Student found but inactive. Email: ${email}, Status: ${status}`);
          throw new Error(`Your account is not active (status: ${status}). Please contact your instructor.`);
        }
        
        // Process unit information
        let unit1 = row[unit1ColIdx] ? row[unit1ColIdx].toString().trim().toUpperCase() : "";
        let unit2 = row[unit2ColIdx] ? row[unit2ColIdx].toString().trim().toUpperCase() : "";
        
        // Clean unit format (handle "UNIT A" -> "A")
        if (unit1.startsWith("UNIT ") && unit1.length > 5) {
          unit1 = unit1.substring(5, 6);
        }
        if (unit2.startsWith("UNIT ") && unit2.length > 5) {
          unit2 = unit2.substring(5, 6);
        }
        
        // Validate units - isValidProductionUnit is available from Config.js
        if (unit1 && !isValidProductionUnit(unit1)) {
          Logger.log(`Invalid unit1 format: ${unit1} for student ${email}`);
          unit1 = "";
        }
        if (unit2 && !isValidProductionUnit(unit2)) {
          Logger.log(`Invalid unit2 format: ${unit2} for student ${email}`);
          unit2 = "";
        }
        
        const studentInfo = {
          studentId: row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null,
          studentName: row[nameColIdx] ? row[nameColIdx].toString().trim() : null,
          studentEmail: studentEmail,
          productionUnit1: unit1,
          productionUnit2: unit2,
          status: status
        };
        
        // Validate student ID format
        if (!studentInfo.studentId || !/^[A-Z]{1}[0-9]{9}$/.test(studentInfo.studentId)) {
          Logger.log(`Invalid student ID format: ${studentInfo.studentId} for email ${email}`);
          throw new Error(`Invalid student ID format in database. Please contact your instructor.`);
        }
        
        // Ensure student has at least one valid unit
        if (!unit1) {
          Logger.log(`No valid production unit assigned to student ${studentInfo.studentId}`);
          throw new Error(`No production unit assigned to your account. Please contact your instructor.`);
        }
        
        Logger.log(`Successfully found student: ${studentInfo.studentId} (${studentInfo.studentName}) in unit ${unit1}`);
        return studentInfo;
      }
    }
    
    // Student not found
    Logger.log(`Student not found in master list for email: ${email}`);
    return null;
    
  } catch (error) {
    Logger.log(`Error in getStudentDetailsByEmail: ${error.message}`);
    throw error;
  }
}

/**
 * Enhanced unit member lookup with better filtering and validation
 * @param {string} unit - Production unit (A, B, C, D)
 * @param {string} currentStudentId - Current user's student ID to exclude
 * @returns {Array} Array of student objects in the same unit
 */
function getUnitMembers(unit, currentStudentId) {
  try {
    // isValidProductionUnit is available from Config.js
    if (!isValidProductionUnit(unit)) {
      Logger.log(`Invalid production unit: ${unit}`);
      return [];
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // PA_MASTER_STUDENT_LIST_SHEET_NAME is available from Config.js
    const sheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    
    if (!sheet) {
      Logger.log("Master student list sheet not found");
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log("No student data found");
      return [];
    }
    
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    
    const idColIdx = headers.indexOf("studentId");
    const nameColIdx = headers.indexOf("studentName");
    const unit1ColIdx = headers.indexOf("unit1");
    const unit2ColIdx = headers.indexOf("unit2");
    const statusColIdx = headers.indexOf("status");
    const emailColIdx = headers.indexOf("email");
    
    if (idColIdx === -1 || nameColIdx === -1 || unit1ColIdx === -1) {
      Logger.log("Required columns not found in master student list");
      return [];
    }
    
    const unitMembers = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentId = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
      const status = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : "";
      let studentUnit1 = row[unit1ColIdx] ? row[unit1ColIdx].toString().trim().toUpperCase() : "";
      let studentUnit2 = row[unit2ColIdx] ? row[unit2ColIdx].toString().trim().toUpperCase() : "";
      
      // Clean unit formats
      if (studentUnit1.startsWith("UNIT ") && studentUnit1.length > 5) {
        studentUnit1 = studentUnit1.substring(5, 6);
      }
      if (studentUnit2.startsWith("UNIT ") && studentUnit2.length > 5) {
        studentUnit2 = studentUnit2.substring(5, 6);
      }
      
      // Include if: same unit (primary or secondary), active/enrolled, not current user, valid ID
      const isInTargetUnit = (studentUnit1 === unit || studentUnit2 === unit);
      const isActive = (status === "active" || status === "enrolled");
      const isNotCurrentUser = (studentId !== currentStudentId);
      const hasValidId = (studentId && /^[A-Z]{1}[0-9]{9}$/.test(studentId));
      
      if (isInTargetUnit && isActive && isNotCurrentUser && hasValidId) {
        unitMembers.push({
          studentId: studentId,
          studentName: row[nameColIdx] ? row[nameColIdx].toString().trim() : `[Name for ${studentId}]`,
          studentEmail: row[emailColIdx] ? row[emailColIdx].toString().trim().toLowerCase() : "",
          productionUnit: unit,
          status: status
        });
      }
    }
    
    // Sort by name for consistent display
    unitMembers.sort((a, b) => a.studentName.localeCompare(b.studentName));
    
    Logger.log(`Found ${unitMembers.length} unit members for unit ${unit} (excluding ${currentStudentId})`);
    return unitMembers;
    
  } catch (error) {
    Logger.log(`Error getting unit members: ${error.message}`);
    return [];
  }
}

/**
 * Get all active students for faculty access
 * @returns {Array} Array of all active students
 */
function getAllActiveStudentsForFaculty() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // PA_MASTER_STUDENT_LIST_SHEET_NAME is available from Config.js
    const sheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    
    if (!sheet) {
      Logger.log("Master student list sheet not found");
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log("No student data found");
      return [];
    }
    
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    
    const idColIdx = headers.indexOf("studentId");
    const nameColIdx = headers.indexOf("studentName");
    const emailColIdx = headers.indexOf("email");
    const unit1ColIdx = headers.indexOf("unit1");
    const statusColIdx = headers.indexOf("status");
    
    if (idColIdx === -1 || nameColIdx === -1 || statusColIdx === -1) {
      Logger.log("Required columns not found in master student list");
      return [];
    }
    
    const allStudents = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentId = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
      const status = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : "";
      let unit1 = row[unit1ColIdx] ? row[unit1ColIdx].toString().trim().toUpperCase() : "";
      
      // Clean unit format
      if (unit1.startsWith("UNIT ") && unit1.length > 5) {
        unit1 = unit1.substring(5, 6);
      }
      
      // Include if: active/enrolled, valid ID
      if ((status === "active" || status === "enrolled") && 
          studentId && /^[A-Z]{1}[0-9]{9}$/.test(studentId)) {
        
        allStudents.push({
          studentId: studentId,
          studentName: row[nameColIdx] ? row[nameColIdx].toString().trim() : `[Name for ${studentId}]`,
          studentEmail: row[emailColIdx] ? row[emailColIdx].toString().trim().toLowerCase() : "",
          productionUnit: unit1 || 'UNASSIGNED',
          status: status
        });
      }
    }
    
    // Sort by unit, then by name for organized display
    allStudents.sort((a, b) => {
      if (a.productionUnit !== b.productionUnit) {
        return a.productionUnit.localeCompare(b.productionUnit);
      }
      return a.studentName.localeCompare(b.studentName);
    });
    
    Logger.log(`Found ${allStudents.length} active students for faculty access`);
    return allStudents;
    
  } catch (error) {
    Logger.log(`Error getting all active students: ${error.message}`);
    return [];
  }
}

/**
 * Enhanced assessment permission validation with detailed logging
 * @param {string} evaluatorId - Student ID of evaluator
 * @param {string} evaluatedId - Student ID of student being evaluated
 * @returns {boolean} True if evaluation is allowed
 */

// eslint-disable-next-line no-unused-vars
function validateAssessmentPermission(evaluatorId, evaluatedId) {
  try {
    // Students cannot evaluate themselves
    if (evaluatorId === evaluatedId) {
      Logger.log(`Self-evaluation not allowed: ${evaluatorId}`);
      return false;
    }
    
    // Get both students' unit information
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // PA_MASTER_STUDENT_LIST_SHEET_NAME is available from Config.js
    const sheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    
    if (!sheet) {
      Logger.log("Master student list sheet not found for permission validation");
      return false;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    
    const idColIdx = headers.indexOf("studentId");
    const unit1ColIdx = headers.indexOf("unit1");
    const unit2ColIdx = headers.indexOf("unit2");
    const statusColIdx = headers.indexOf("status");
    
    let evaluatorInfo = null;
    let evaluatedInfo = null;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentId = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
      const status = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : "";
      
      // Only consider active students
      if (status !== "active" && status !== "enrolled") continue;
      
      let unit1 = row[unit1ColIdx] ? row[unit1ColIdx].toString().trim().toUpperCase() : "";
      let unit2 = row[unit2ColIdx] ? row[unit2ColIdx].toString().trim().toUpperCase() : "";
      
      // Clean unit formats
      if (unit1.startsWith("UNIT ") && unit1.length > 5) {
        unit1 = unit1.substring(5, 6);
      }
      if (unit2.startsWith("UNIT ") && unit2.length > 5) {
        unit2 = unit2.substring(5, 6);
      }
      
      if (studentId === evaluatorId) {
        evaluatorInfo = { studentId, unit1, unit2, status };
      }
      if (studentId === evaluatedId) {
        evaluatedInfo = { studentId, unit1, unit2, status };
      }
      
      if (evaluatorInfo && evaluatedInfo) {
        break;
      }
    }
    
    if (!evaluatorInfo) {
      Logger.log(`Evaluator not found or inactive: ${evaluatorId}`);
      return false;
    }
    
    if (!evaluatedInfo) {
      Logger.log(`Evaluated student not found or inactive: ${evaluatedId}`);
      return false;
    }
    
    // Check if students share at least one unit
    // isValidProductionUnit is available from Config.js
    const evaluatorUnits = [evaluatorInfo.unit1, evaluatorInfo.unit2].filter(u => u && isValidProductionUnit(u));
    const evaluatedUnits = [evaluatedInfo.unit1, evaluatedInfo.unit2].filter(u => u && isValidProductionUnit(u));
    
    const sharedUnits = evaluatorUnits.filter(unit => evaluatedUnits.includes(unit));
    
    if (sharedUnits.length > 0) {
      Logger.log(`Assessment permission granted: ${evaluatorId} can evaluate ${evaluatedId} (shared units: ${sharedUnits.join(', ')})`);
      return true;
    } else {
      Logger.log(`Assessment permission denied: ${evaluatorId} and ${evaluatedId} do not share any units. Evaluator units: [${evaluatorUnits.join(', ')}], Evaluated units: [${evaluatedUnits.join(', ')}]`);
      return false;
    }
    
  } catch (error) {
    Logger.log(`Error validating assessment permission: ${error.message}`);
    return false;
  }
}

/**
 * Wrapper function for web app compatibility
 * @returns {Object} Same as getCurrentUserSession()
 */
// eslint-disable-next-line no-unused-vars
function getCurrentUser() {
  return getCurrentUserSession();
}