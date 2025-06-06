/* global getCurrentUserSession, parseRawSurveyData, PA_QUESTION_CONFIG_SHEET_NAME */

/**
 * @file WebAPI.js
 * @description Unified Web Application API - CORRECTED VERSION
 * All function calls have been standardized to use getCurrentUserSession()
 */

// ==============================================
// WEB APP ENTRY POINTS
// ==============================================

/**
 * Main web app entry point for GET requests
 */
// eslint-disable-next-line no-unused-vars
function doGet(e) {
  try {
    Logger.log('Web app accessed');
    
    // Get current user to determine interface type
    const userSession = getCurrentUserSession();
    
    if (!userSession.isAuthenticated) {
      return createAuthenticationInterface(userSession.error);
    }
    
    // Route based on user role
    if (userSession.role === 'instructor') {
      return createInstructorInterface(userSession);
    } else if (userSession.role === 'student') {
      return createStudentInterface(userSession);
    } else {
      throw new Error('Invalid user role');
    }
    
  } catch (error) {
    Logger.log(`Web app error: ${error.message}`);
    return createErrorInterface(error.message);
  }
}

/**
 * Handle POST requests (redirect to GET)
 */
// eslint-disable-next-line no-unused-vars
function doPost(e) {
  return doGet(e);
}

// ==============================================
// FRONTEND API FUNCTIONS
// These are called directly by the HTML interface
// ==============================================

function getCurrentUser() {
  // Use the AuthHandler instead of doing our own authentication
  try {
    const userSession = getCurrentUserSession(); // This calls AuthHandler.js
    return userSession;
  } catch (error) {
    Logger.log(`getCurrentUser error: ${error.message}`);
    return {
      isAuthenticated: false,
      error: error.message
    };
  }
}

/**
 * Get question definitions for the web interface
 * Uses your existing parser logic
 */
// eslint-disable-next-line no-unused-vars
function getQuestionDefinitionsForWeb() {
  try {
    // Use existing function from Parser_V2.js logic
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheetName = PA_QUESTION_CONFIG_SHEET_NAME;
    const sheet = ss.getSheetByName(configSheetName);
    
    if (!sheet) {
      throw new Error(`Question configuration sheet "${configSheetName}" not found`);
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      throw new Error('No questions found in configuration sheet');
    }
    
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    const idColIdx = headers.indexOf("QuestionID");
    const textColIdx = headers.indexOf("QuestionText");
    const typeColIdx = headers.indexOf("QuestionType");
    const instructionColIdx = headers.indexOf("InstructionalComment");
    
    if (idColIdx === -1 || textColIdx === -1) {
      throw new Error('Required headers (QuestionID, QuestionText) not found');
    }
    
    const questionsMap = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const qId = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
      const qText = row[textColIdx] ? row[textColIdx].toString().trim() : null;
      
      if (qId && qText) {
        const qType = (typeColIdx !== -1 && row[typeColIdx]) ? row[typeColIdx].toString().trim() : "LikertScale";
        const qInstruction = (instructionColIdx !== -1 && row[instructionColIdx]) ? row[instructionColIdx].toString().trim() : "";
        
        questionsMap[qId] = {
          questionId: qId,
          questionPrompt: qText,
          questionInstruction: qInstruction,
          questionType: qType
        };
      }
    }
    
    Logger.log(`Loaded ${Object.keys(questionsMap).length} questions for web interface`);
    return questionsMap;
    
  } catch (error) {
    Logger.log(`Error in getQuestionDefinitionsForWeb: ${error.message}`);
    throw new Error(`Failed to load questions: ${error.message}`);
  }
}

// Note: submitPeerAssessments is already defined in SubmissionHandler.js
// No need to redefine it here - it will be called directly

// ==============================================
// INTERFACE CREATION FUNCTIONS
// ==============================================

function createStudentInterface(userSession) {
  Logger.log('Creating student interface for user: ' + userSession.email);
  
  // Just return the HTML file directly - no data passing needed
  return HtmlService.createHtmlOutputFromFile('AssessmentInterface')
    .setTitle('Peer Assessment Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Create the instructor dashboard interface
 */
function createInstructorInterface(userSession) {
  const htmlOutput = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Instructor Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 20px; 
          background: #f5f5f5; 
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
          padding: 30px; 
          border-radius: 10px; 
          margin-bottom: 30px; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .card { 
          background: white; 
          padding: 20px; 
          margin: 15px 0; 
          border-radius: 8px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .btn { 
          background: #667eea; 
          color: white; 
          padding: 12px 24px; 
          border: none; 
          border-radius: 5px; 
          cursor: pointer; 
          margin: 5px; 
          text-decoration: none; 
          display: inline-block; 
          transition: background 0.3s ease;
        }
        .btn:hover { 
          background: #5a6fd8; 
        }
        .btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .stats-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
          gap: 15px; 
          margin: 20px 0; 
        }
        .stat-card { 
          background: white; 
          padding: 20px; 
          border-radius: 8px; 
          text-align: center; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .stat-number { 
          font-size: 2em; 
          font-weight: bold; 
          color: #667eea; 
        }
        .stat-label { 
          color: #666; 
          margin-top: 5px; 
        }
        .actions { 
          display: flex; 
          flex-wrap: wrap; 
          gap: 10px; 
          margin: 20px 0; 
        }
        #status { 
          margin: 10px 0; 
          padding: 10px; 
          border-radius: 5px; 
          display: none; 
        }
        #status.success { 
          background: #d4edda; 
          color: #155724; 
          border: 1px solid #c3e6cb; 
          display: block; 
        }
        #status.error { 
          background: #f8d7da; 
          color: #721c24; 
          border: 1px solid #f5c6cb; 
          display: block; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Instructor Dashboard</h1>
        <p>Welcome, ${userSession.email}</p>
      </div>
      
      <div id="status"></div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number" id="totalStudents">Loading...</div>
          <div class="stat-label">Total Students</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="totalResponses">Loading...</div>
          <div class="stat-label">Total Responses</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="totalQuestions">Loading...</div>
          <div class="stat-label">Questions</div>
        </div>
      </div>
      
      <div class="card">
        <h2>🔧 System Actions</h2>
        <div class="actions">
          <button class="btn" onclick="runAction('analytics')">Generate Analytics</button>
          <button class="btn" onclick="runAction('scoring')">Calculate Scores</button>
          <button class="btn" onclick="runAction('reports')">Generate Reports</button>
          <button class="btn" onclick="runAction('missing')">Find Missing Assessments</button>
          <button class="btn" onclick="openSpreadsheet()">Open Spreadsheet</button>
        </div>
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          loadStatistics();
        });
        
        function showStatus(message, type) {
          const status = document.getElementById('status');
          status.textContent = message;
          status.className = type;
          setTimeout(() => {
            status.style.display = 'none';
          }, 5000);
        }
        
        async function loadStatistics() {
          try {
            const stats = await new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .getSystemStatisticsSafe();
            });
            
            document.getElementById('totalStudents').textContent = stats.totalStudents || '0';
            document.getElementById('totalResponses').textContent = stats.totalResponses || '0';
            document.getElementById('totalQuestions').textContent = stats.totalQuestions || '0';
            
          } catch (error) {
            console.error('Failed to load statistics:', error);
            showStatus('Failed to load statistics: ' + error.message, 'error');
          }
        }
        
        async function runAction(type) {
          const button = event.target;
          const originalText = button.textContent;
          button.textContent = 'Running...';
          button.disabled = true;
          
          try {
            let functionName;
            switch(type) {
              case 'analytics':
                functionName = 'generateEvaluatorAnalyticsAndWeights';
                break;
              case 'scoring':
                functionName = 'calculateWeightedScoresAndUpdateSheet';
                break;
              case 'reports':
                functionName = 'generateRawScoresReportWithWeights';
                break;
              case 'missing':
                functionName = 'findStudentsWhoHaventAssessedSpecificPeers';
                break;
              default:
                throw new Error('Unknown action type');
            }
            
            await new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                [functionName]();
            });
            
            showStatus(originalText + ' completed successfully!', 'success');
            loadStatistics(); // Refresh stats
            
          } catch (error) {
            console.error('Action failed:', error);
            showStatus(originalText + ' failed: ' + error.message, 'error');
          } finally {
            button.textContent = originalText;
            button.disabled = false;
          }
        }
        
        function openSpreadsheet() {
          window.open('${SpreadsheetApp.getActiveSpreadsheet().getUrl()}', '_blank');
        }
      </script>
    </body>
    </html>
  `);
  
  return htmlOutput
    .setTitle('Instructor Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Create authentication required interface
 */
function createAuthenticationInterface(errorMessage) {
  const htmlOutput = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Required</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: #f5f5f5; 
          margin: 0;
        }
        .container { 
          max-width: 500px; 
          margin: 0 auto; 
          background: white; 
          padding: 40px; 
          border-radius: 10px; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .error { 
          color: #d73027; 
          margin: 20px 0; 
          padding: 15px; 
          background: #fdf2f2; 
          border-radius: 5px; 
          border: 1px solid #f5c6cb;
        }
        .btn { 
          background: #4285f4; 
          color: white; 
          padding: 12px 24px; 
          border: none; 
          border-radius: 5px; 
          cursor: pointer; 
          text-decoration: none; 
          display: inline-block; 
          margin: 10px; 
          transition: background 0.3s ease;
        }
        .btn:hover {
          background: #3367d6;
        }
        .icon { 
          font-size: 3em; 
          margin-bottom: 20px; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🔐</div>
        <h1>Authentication Required</h1>
        <p>Please log in with your SHU Google account to access the Peer Assessment system.</p>
        
        ${errorMessage ? `<div class="error">Error: ${errorMessage}</div>` : ''}
        
        <p style="margin-top: 30px; color: #666; font-size: 0.9em;">
          Make sure you're using your institutional email address ending with @mail.shu.edu.tw
        </p>
        
        <button onclick="window.location.reload()" class="btn">
          Try Again
        </button>
      </div>
    </body>
    </html>
  `);
  
  return htmlOutput
    .setTitle('Authentication Required')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Create error interface
 */
function createErrorInterface(errorMessage) {
  const htmlOutput = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Application Error</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: #f5f5f5; 
          margin: 0;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          padding: 40px; 
          border-radius: 10px; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .error { 
          color: #d73027; 
        }
        .btn { 
          background: #4285f4; 
          color: white; 
          padding: 12px 24px; 
          border: none; 
          border-radius: 5px; 
          cursor: pointer; 
          text-decoration: none; 
          display: inline-block; 
          margin: 10px; 
        }
        .error-details {
          background: #f8f8f8; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 20px 0; 
          font-family: monospace;
          text-align: left;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="error">❌ Application Error</h1>
        <p>Sorry, there was an error loading the application.</p>
        <div class="error-details">${errorMessage}</div>
        <a href="?" class="btn">Try Again</a>
      </div>
    </body>
    </html>
  `);
  
  return htmlOutput
    .setTitle('Application Error')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ==============================================
// STATISTICS AND SUPPORT FUNCTIONS
// ==============================================

/**
 * Get system statistics for the instructor dashboard (SAFE VERSION)
 */
// eslint-disable-next-line no-unused-vars
function getSystemStatisticsSafe() {
  try {
    Logger.log('getSystemStatisticsSafe called');
    
    const parsedData = parseRawSurveyData();
    if (!parsedData) {
      Logger.log('parseRawSurveyData returned null');
      return { 
        totalStudents: 0, 
        totalResponses: 0, 
        totalQuestions: 0,
        error: 'Failed to parse data' 
      };
    }
    
    const totalStudents = Object.keys(parsedData.students).length;
    const totalQuestions = Object.keys(parsedData.questions).length;
    const totalResponses = parsedData.responses.length;
    
    Logger.log(`Statistics: ${totalStudents} students, ${totalQuestions} questions, ${totalResponses} responses`);
    
    return {
      totalStudents,
      totalQuestions,
      totalResponses
    };
    
  } catch (error) {
    Logger.log(`Error in getSystemStatisticsSafe: ${error.message}`);
    Logger.log(`Error stack: ${error.stack}`);
    return { 
      totalStudents: 0, 
      totalResponses: 0, 
      totalQuestions: 0,
      error: error.message 
    };
  }
}
// Add this debug function
function debugFunctionAvailability() {
  Logger.log("=== FUNCTION AVAILABILITY DEBUG ===");
  
  // Test if functions exist
  const functions = {
    getCurrentUser: typeof getCurrentUser,
    getCurrentUserSession: typeof getCurrentUserSession,
    getQuestionDefinitionsForWeb: typeof getQuestionDefinitionsForWeb,
    submitPeerAssessments: typeof submitPeerAssessments
  };
  
  Logger.log("Function types:", JSON.stringify(functions));
  
  // Test actual calls
  try {
    const session = getCurrentUser();
    Logger.log("getCurrentUser works:", !!session);
  } catch (error) {
    Logger.log("getCurrentUser error:", error.message);
  }
  
  try {
    const questions = getQuestionDefinitionsForWeb();
    Logger.log("getQuestionDefinitionsForWeb works:", Object.keys(questions).length, "questions");
  } catch (error) {
    Logger.log("getQuestionDefinitionsForWeb error:", error.message);
  }
  
  return functions;
}

/**
 * Get completed assessments for the current user
 * Returns array of student IDs that have been evaluated by this user
 */
function getCompletedAssessments() {
  try {
    Logger.log('getCompletedAssessments called');
    
    // Get current user session to identify evaluator
    const userSession = getCurrentUserSession();
    if (!userSession || !userSession.isAuthenticated) {
      Logger.log('User not authenticated');
      return [];
    }
    
    const evaluatorId = userSession.studentId;
    Logger.log('Checking completed assessments for evaluator: ' + evaluatorId);
    
    // Get submissions sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionsSheet = ss.getSheetByName('PaRawSubmissionsV2');
    
    if (!submissionsSheet) {
      Logger.log('PaRawSubmissionsV2 sheet not found');
      return [];
    }
    
    const data = submissionsSheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('No submission data found');
      return [];
    }
    
    // Find column indices
    const headers = data[0];
    const evaluatorIdCol = headers.indexOf('evaluatorId');
    const evaluatedStudentIdCol = headers.indexOf('evaluatedStudentId');
    const responseTypeCol = headers.indexOf('responseType');
    
    if (evaluatorIdCol === -1 || evaluatedStudentIdCol === -1 || responseTypeCol === -1) {
      Logger.log('Required columns not found in submissions sheet');
      return [];
    }
    
    // Find unique students this evaluator has submitted SCORE responses for
    const completedStudents = new Set();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEvaluatorId = row[evaluatorIdCol];
      const rowEvaluatedStudentId = row[evaluatedStudentIdCol];
      const rowResponseType = row[responseTypeCol];
      
      // Check if this is a score submission from our evaluator
      if (rowEvaluatorId === evaluatorId && rowResponseType === 'SCORE' && rowEvaluatedStudentId) {
        completedStudents.add(rowEvaluatedStudentId);
      }
    }
    
    const completedArray = Array.from(completedStudents);
    Logger.log(`Found ${completedArray.length} completed assessments: ${completedArray.join(', ')}`);
    
    return completedArray;
    
  } catch (error) {
    Logger.log(`Error in getCompletedAssessments: ${error.message}`);
    return [];
  }
}

// === TEMPORARY TEST FUNCTION ===
function testGetCompletedAssessments() {
  const completed = getCompletedAssessments();
  console.log('Completed assessments found:', completed);
  console.log('Should include A113031046:', completed.includes('A113031046'));
  return completed;
}