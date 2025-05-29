/* global getStudentDetailsByEmail, getUnitMembers, checkIfInstructor, getAllActiveStudentsForFaculty */

/**
 * @file UserTestingScript.js
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
 * Quick function to switch test users - call this from Apps Script editor
 */
// eslint-disable-next-line no-unused-vars
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
// eslint-disable-next-line no-unused-vars
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
// eslint-disable-next-line no-unused-vars
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
// eslint-disable-next-line no-unused-vars
function disableTestMode() {
  Logger.log("To disable test mode, set DEVELOPMENT_MODE = false and CURRENT_TEST_EMAIL = null in the script");
}

// Add wrapper for backwards compatibility
// eslint-disable-next-line no-unused-vars
function getCurrentUser() {
  return getCurrentUserSession();
}