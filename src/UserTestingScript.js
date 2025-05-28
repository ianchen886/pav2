/**
 * @file RealUserTestingScript.js
 * @description Testing script to simulate different real student logins for development
 * Uses actual students from the master list for realistic testing
 */

/**
 * Real test users from your master student list
 * Change CURRENT_TEST_EMAIL to switch between these users
 */
const TEST_STUDENT_EMAILS = [
  'a113031034@mail.shu.edu.tw',
  'a113031056@mail.shu.edu.tw', 
  'a113031082@mail.shu.edu.tw',
  'a113031086@mail.shu.edu.tw'
];

/**
 * Current test user email (change this to switch users)
 * Set to null to use real authentication
 */
const CURRENT_TEST_EMAIL = 'a113031034@mail.shu.edu.tw'; // Change this to test different users

/**
 * Development mode flag - set to false for production
 */
const DEVELOPMENT_MODE = true;

/**
 * Enhanced getCurrentUserSession for testing with real students
 * This allows you to simulate login as any real student from your master list
 */
function getCurrentUserSession() {
  // In development mode with a test email selected
  if (DEVELOPMENT_MODE && CURRENT_TEST_EMAIL) {
    Logger.log(`DEVELOPMENT MODE: Simulating login as ${CURRENT_TEST_EMAIL}`);
    return createTestSessionFromRealStudent(CURRENT_TEST_EMAIL);
  }
  
  // Otherwise use real authentication
  return getCurrentUserSessionReal();
}

/**
 * Create test session using real student data from master list
 */
function createTestSessionFromRealStudent(testEmail) {
  try {
    Logger.log(`Creating test session for real student: ${testEmail}`);
    
    // Get real student details from master list
    const studentDetails = getStudentDetailsByEmail(testEmail);
    if (!studentDetails) {
      throw new Error(`Test student not found in master list: ${testEmail}`);
    }
    
    const productionUnit = studentDetails.productionUnit1;
    let unitMembers = [];
    
    // Get real unit members
    if (productionUnit) {
      unitMembers = getUnitMembers(productionUnit, studentDetails.studentId);
    }
    
    return {
      email: testEmail,
      isAuthenticated: true,
      role: 'student',
      studentId: studentDetails.studentId,
      studentName: studentDetails.studentName,
      productionUnit: productionUnit,
      unitMembers: unitMembers,
      timestamp: new Date().toISOString(),
      isTestSession: true // Flag to indicate this is a test session
    };
    
  } catch (error) {
    Logger.log(`Test session creation error: ${error.message}`);
    return {
      isAuthenticated: false,
      error: `Test session failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * The original authentication function (renamed to avoid conflicts)
 */
function getCurrentUserSessionReal() {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      throw new Error("No authenticated user found");
    }
    
    Logger.log(`Real authentication attempt for email: ${email}`);
    
    // Check if user is an instructor
    const isInstructor = checkIfInstructor(email);
    
    if (isInstructor) {
      return createFacultySession(email);
    }
    
    // If student, get their details from master list
    let studentDetails = getStudentDetailsByEmail(email);
    if (!studentDetails) {
      throw new Error("Student not found in master list or not active");
    }
    
    const productionUnit = studentDetails.productionUnit1;
    let unitMembers = [];
    
    if (productionUnit) {
      unitMembers = getUnitMembers(productionUnit, studentDetails.studentId);
    }
    
    return {
      email: email,
      isAuthenticated: true,
      role: 'student',
      studentId: studentDetails.studentId,
      studentName: studentDetails.studentName,
      productionUnit: productionUnit,
      unitMembers: unitMembers,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`Real authentication error: ${error.message}`);
    return {
      isAuthenticated: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced faculty session that can access all students
 */
function createFacultySession(email) {
  try {
    Logger.log(`Creating faculty session for: ${email}`);
    
    // Get all active students for faculty to evaluate
    const allStudents = getAllActiveStudentsForFaculty();
    
    return {
      email: email,
      isAuthenticated: true,
      role: 'instructor',
      studentId: 'FACULTY_' + email.split('@')[0].toUpperCase(),
      studentName: 'Faculty Member (' + email.split('@')[0].toUpperCase() + ')',
      productionUnit: 'FACULTY',
      unitMembers: allStudents, // Faculty can evaluate all students
      timestamp: new Date().toISOString(),
      isFaculty: true
    };
    
  } catch (error) {
    Logger.log(`Faculty session creation error: ${error.message}`);
    return {
      isAuthenticated: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get all active students for faculty access
 * This is the key function that allows faculty to see all students
 */
function getAllActiveStudentsForFaculty() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
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
 * Testing utility functions
 */

/**
 * Quick function to switch test users - call this from Apps Script editor
 */
function switchTestUser(email) {
  if (TEST_STUDENT_EMAILS.includes(email)) {
    // This would require modifying the CURRENT_TEST_EMAIL constant
    Logger.log(`To switch to ${email}, update CURRENT_TEST_EMAIL in the script`);
    Logger.log(`Available test emails: ${TEST_STUDENT_EMAILS.join(', ')}`);
  } else {
    Logger.log(`Email ${email} not in test list. Available: ${TEST_STUDENT_EMAILS.join(', ')}`);
  }
}

/**
 * List all available test users - call this from Apps Script editor
 */
function listTestUsers() {
  Logger.log("Available test student emails:");
  TEST_STUDENT_EMAILS.forEach((email, index) => {
    const studentData = getStudentDetailsByEmail(email);
    if (studentData) {
      Logger.log(`${index + 1}. ${email} - ${studentData.studentName} (${studentData.studentId}) - Unit ${studentData.productionUnit1}`);
    } else {
      Logger.log(`${index + 1}. ${email} - NOT FOUND IN MASTER LIST`);
    }
  });
  Logger.log(`Current test user: ${CURRENT_TEST_EMAIL || 'None (using real auth)'}`);
  Logger.log(`Development mode: ${DEVELOPMENT_MODE}`);
}

/**
 * Test all users to make sure they exist in master list
 */
function validateTestUsers() {
  Logger.log("Validating test users against master list:");
  
  TEST_STUDENT_EMAILS.forEach(email => {
    try {
      const studentData = getStudentDetailsByEmail(email);
      if (studentData) {
        Logger.log(`✅ ${email} - Found: ${studentData.studentName} (${studentData.studentId}) in Unit ${studentData.productionUnit1}`);
      } else {
        Logger.log(`❌ ${email} - NOT FOUND in master list`);
      }
    } catch (error) {
      Logger.log(`❌ ${email} - ERROR: ${error.message}`);
    }
  });
}

/**
 * Disable test mode and use real authentication
 */
function disableTestMode() {
  Logger.log("To disable test mode, set DEVELOPMENT_MODE = false and CURRENT_TEST_EMAIL = null in the script");
}

// Add wrapper for backwards compatibility
function getCurrentUser() {
  return getCurrentUserSession();
}