/* global getStudentDetailsByEmail, getUnitMembers, checkIfInstructor, getAllActiveStudentsForFaculty */

/**
 * @file UserTestingScript.js
 * @description Testing script to simulate different real student logins for development
 * Uses actual students from the master list for realistic testing
 * 
 * IMPORTANT: This file provides test configuration variables and functions that are
 * used by AuthHandler.js when DEVELOPMENT_MODE is enabled. It does NOT override
 * the main authentication function - that integration happens in AuthHandler.js.
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
 * 
 * This variable is checked by AuthHandler.js getCurrentUserSession()
 */
var CURRENT_TEST_EMAIL = 'a113031034@mail.shu.edu.tw'; // Change this to test different users

/**
 * Development mode flag - set to false for production
 * 
 * This variable is checked by AuthHandler.js getCurrentUserSession()
 */
var DEVELOPMENT_MODE = true;

/**
 * Create test session using real student data from master list
 * This function is called by AuthHandler.js when in test mode
 * 
 * @param {string} testEmail - Email of the student to simulate
 * @returns {Object} Test session object matching real session format
 */
function createTestSessionFromRealStudent(testEmail) {
  try {
    Logger.log(`Creating test session for real student: ${testEmail}`);
    
    // Check if user is an instructor
    const isInstructor = checkIfInstructor(testEmail);
    
    if (isInstructor) {
      return createFacultySession(testEmail);
    }
    
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
      Logger.log(`Found ${unitMembers.length} unit members for test student ${studentDetails.studentId} in unit ${productionUnit}`);
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
      sessionData: {
        totalPeersToEvaluate: unitMembers ? unitMembers.length : 0,
        hasValidUnit: !!productionUnit,
        canSubmitAssessments: !!studentDetails && !!productionUnit && unitMembers && unitMembers.length > 0
      },
      isTestSession: true // Flag to indicate this is a test session
    };
    
  } catch (error) {
    Logger.log(`Test session creation error: ${error.message}`);
    return {
      isAuthenticated: false,
      error: `Test session failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      email: null,
      role: null
    };
  }
}

/**
 * Enhanced faculty session that can access all students
 * @param {string} email - Faculty email address
 * @returns {Object} Faculty session object
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
      sessionData: {
        totalPeersToEvaluate: allStudents.length,
        hasValidUnit: true,
        canSubmitAssessments: true
      },
      isFaculty: true,
      isTestSession: true
    };
    
  } catch (error) {
    Logger.log(`Faculty session creation error: ${error.message}`);
    return {
      isAuthenticated: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      email: null,
      role: null
    };
  }
}

// ===================================================================================
// TEST UTILITY FUNCTIONS
// These functions help developers manage and validate test configurations
// ===================================================================================

/**
 * Quick function to switch test users - call this from Apps Script editor
 * @param {string} email - Email to switch to
 */
// eslint-disable-next-line no-unused-vars
function switchTestUser(email) {
  if (TEST_STUDENT_EMAILS.includes(email)) {
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
  Logger.clear();
  Logger.log("=== AVAILABLE TEST USERS ===");
  TEST_STUDENT_EMAILS.forEach((email, index) => {
    try {
      const studentData = getStudentDetailsByEmail(email);
      if (studentData) {
        Logger.log(`${index + 1}. ${email}`);
        Logger.log(`   Name: ${studentData.studentName}`);
        Logger.log(`   ID: ${studentData.studentId}`);
        Logger.log(`   Unit: ${studentData.productionUnit1}`);
        Logger.log(`   Status: ${studentData.status}`);
      } else {
        Logger.log(`${index + 1}. ${email} - ❌ NOT FOUND IN MASTER LIST`);
      }
    } catch (error) {
      Logger.log(`${index + 1}. ${email} - ❌ ERROR: ${error.message}`);
    }
    Logger.log(''); // Empty line for readability
  });
  
  Logger.log("=== CURRENT CONFIGURATION ===");
  Logger.log(`Current test user: ${CURRENT_TEST_EMAIL || 'None (using real auth)'}`);
  Logger.log(`Development mode: ${DEVELOPMENT_MODE}`);
  Logger.log(`Test mode active: ${DEVELOPMENT_MODE && CURRENT_TEST_EMAIL ? 'YES' : 'NO'}`);
}

/**
 * Test all users to make sure they exist in master list
 */
// eslint-disable-next-line no-unused-vars
function validateTestUsers() {
  Logger.clear();
  Logger.log("=== VALIDATING TEST USERS ===");
  
  let validCount = 0;
  let invalidCount = 0;
  
  TEST_STUDENT_EMAILS.forEach((email, index) => {
    try {
      const studentData = getStudentDetailsByEmail(email);
      if (studentData) {
        Logger.log(`✅ ${index + 1}. ${email} - VALID`);
        Logger.log(`    ${studentData.studentName} (${studentData.studentId}) in Unit ${studentData.productionUnit1}`);
        validCount++;
      } else {
        Logger.log(`❌ ${index + 1}. ${email} - NOT FOUND in master list`);
        invalidCount++;
      }
    } catch (error) {
      Logger.log(`❌ ${index + 1}. ${email} - ERROR: ${error.message}`);
      invalidCount++;
    }
  });
  
  Logger.log('');
  Logger.log(`=== VALIDATION SUMMARY ===`);
  Logger.log(`Valid test users: ${validCount}`);
  Logger.log(`Invalid test users: ${invalidCount}`);
  Logger.log(`Total test users: ${TEST_STUDENT_EMAILS.length}`);
  
  if (invalidCount > 0) {
    Logger.log('⚠️  Some test users are invalid. Update TEST_STUDENT_EMAILS with valid student emails from your master list.');
  } else {
    Logger.log('✅ All test users are valid!');
  }
}

/**
 * Test the current test session configuration
 */
// eslint-disable-next-line no-unused-vars
function testCurrentConfiguration() {
  Logger.clear();
  Logger.log("=== TESTING CURRENT CONFIGURATION ===");
  Logger.log(`Development mode: ${DEVELOPMENT_MODE}`);
  Logger.log(`Current test email: ${CURRENT_TEST_EMAIL}`);
  Logger.log('');
  
  if (!DEVELOPMENT_MODE) {
    Logger.log("✅ Development mode is DISABLED - real authentication will be used");
    return;
  }
  
  if (!CURRENT_TEST_EMAIL) {
    Logger.log("⚠️  Development mode is ENABLED but no test email is set - real authentication will be used");
    return;
  }
  
  Logger.log("🧪 Test mode is ACTIVE - attempting to create test session...");
  
  try {
    const testSession = createTestSessionFromRealStudent(CURRENT_TEST_EMAIL);
    
    if (testSession.isAuthenticated) {
      Logger.log("✅ Test session created successfully!");
      Logger.log(`   Email: ${testSession.email}`);
      Logger.log(`   Role: ${testSession.role}`);
      Logger.log(`   Student ID: ${testSession.studentId}`);
      Logger.log(`   Student Name: ${testSession.studentName}`);
      Logger.log(`   Production Unit: ${testSession.productionUnit}`);
      Logger.log(`   Unit Members: ${testSession.unitMembers ? testSession.unitMembers.length : 0}`);
      Logger.log(`   Can Submit: ${testSession.sessionData ? testSession.sessionData.canSubmitAssessments : 'Unknown'}`);
    } else {
      Logger.log("❌ Test session creation failed!");
      Logger.log(`   Error: ${testSession.error}`);
    }
  } catch (error) {
    Logger.log("❌ Test session creation threw an error!");
    Logger.log(`   Error: ${error.message}`);
  }
}

/**
 * Disable test mode and use real authentication
 */
// eslint-disable-next-line no-unused-vars
function disableTestMode() {
  Logger.log("To disable test mode:");
  Logger.log("1. Set DEVELOPMENT_MODE = false");
  Logger.log("2. Set CURRENT_TEST_EMAIL = null");
  Logger.log("3. These changes will take effect immediately");
}

/**
 * Enable test mode with a specific user
 * @param {string} email - Email to test with
 */
// eslint-disable-next-line no-unused-vars
function enableTestMode(email) {
  if (!email) {
    Logger.log("Usage: enableTestMode('email@mail.shu.edu.tw')");
    Logger.log("Available emails: " + TEST_STUDENT_EMAILS.join(', '));
    return;
  }
  
  Logger.log(`To enable test mode with ${email}:`);
  Logger.log("1. Set DEVELOPMENT_MODE = true");
  Logger.log(`2. Set CURRENT_TEST_EMAIL = '${email}'`);
  Logger.log("3. These changes will take effect immediately");
  
  if (!TEST_STUDENT_EMAILS.includes(email)) {
    Logger.log(`⚠️  Warning: ${email} is not in the TEST_STUDENT_EMAILS list`);
  }
}