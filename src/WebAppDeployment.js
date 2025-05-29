/* global PA_MASTER_STUDENT_LIST_SHEET_NAME, PA_QUESTION_CONFIG_SHEET_NAME, PA_RAW_SUBMISSIONS_V2_SHEET_NAME, parseRawSurveyData, isValidProductionUnit, getCurrentUserSession, getQuestionDefinitions, submitPeerAssessments */

/**
 * @file WebAppDeployment.js
 * @description Fixed web app setup for the peer assessment system including
 * authentication, routing, and API endpoints.
 */

/**
 * Main web app entry point
 * Handles GET requests and routes based on parameters
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'main';
    
    Logger.log(`Web app accessed with action: ${action}`);
    
    // Route to different pages based on action parameter
    switch (action) {
      case 'assessment':
        return createAssessmentInterface();
      case 'instructor':
        return createInstructorInterface();
      case 'logout':
        return createLogoutPage();
      default:
        return createMainInterface();
    }
    
  } catch (error) {
    Logger.log(`Web app error: ${error.message}`);
    return createErrorPage(error.message);
  }
}

/**
 * Handle POST requests (redirect to GET)
 */
// eslint-disable-next-line no-unused-vars
function doPost(e) {
  return doGet(e);
}

/**
 * Main interface that checks authentication and routes appropriately
 */
function createMainInterface() {
  try {
    const userSession = getCurrentUserSession();
    
    if (!userSession.isAuthenticated) {
      return createAuthenticationPage(userSession.error);
    }
    
    // Route based on user role
    if (userSession.role === 'instructor' || userSession.isFaculty) {
      return createInstructorDashboard(userSession);
    } else {
      return createStudentAssessmentPage(userSession);
    }
    
  } catch (error) {
    return createErrorPage(error.message);
  }
}

/**
 * Updated getStudentFromMasterList to handle faculty lookups
 * Replace the existing function in your WebAppDeployment.js
 */

// eslint-disable-next-line no-unused-vars
function getStudentFromMasterList(userId) {
  Logger.log('Looking up user: ' + userId);
  
  try {
    // If it's a faculty member, return special faculty info
    if (userId.startsWith('FACULTY_')) {
      const facultyName = userId.replace('FACULTY_', '');
      return {
        studentId: userId,
        studentName: facultyName + ' (Faculty)',
        email: facultyName.toLowerCase() + '@mail.shu.edu.tw',
        productionUnit1: 'FACULTY',
        productionUnit2: '',
        status: 'active'
      };
    }
    
    // For students, continue with existing logic
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    
    if (!masterSheet) {
      throw new Error('Master student list sheet not found');
    }
    
    const data = masterSheet.getDataRange().getValues();
    if (data.length < 2) {
      throw new Error('Master student list is empty');
    }
    
    // Find column indices
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    const idColIdx = headers.indexOf("studentId");
    const nameColIdx = headers.indexOf("studentName");
    const unit1ColIdx = headers.indexOf("unit1");
    const unit2ColIdx = headers.indexOf("unit2");
    const emailColIdx = headers.indexOf("email");
    const statusColIdx = headers.indexOf("status");
    
    if (idColIdx === -1 || nameColIdx === -1 || statusColIdx === -1) {
      throw new Error('Required headers missing in master student list');
    }
    
    // Search for the student
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowStudentId = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
      
      if (rowStudentId === userId.toUpperCase()) {
        const status = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : "";
        
        // Check if student is active
        if (status !== "active" && status !== "enrolled") {
          throw new Error('Student account is not active. Status: ' + status);
        }
        
        // Extract unit information
        let unit1 = row[unit1ColIdx] ? row[unit1ColIdx].toString().trim().toUpperCase() : "";
        if (unit1.startsWith("UNIT ") && unit1.length > 5) {
          unit1 = unit1.substring(5, 6);
        }
        
        let unit2 = row[unit2ColIdx] ? row[unit2ColIdx].toString().trim().toUpperCase() : "";
        if (unit2.startsWith("UNIT ") && unit2.length > 5) {
          unit2 = unit2.substring(5, 6);
        }
        
        // Validate units
        if (unit1 && !isValidProductionUnit(unit1)) unit1 = "";
        if (unit2 && !isValidProductionUnit(unit2)) unit2 = "";
        
        if (!unit1) {
          throw new Error('No valid production unit assigned to student');
        }
        
        const studentInfo = {
          studentId: rowStudentId,
          studentName: row[nameColIdx] ? row[nameColIdx].toString().trim() : "",
          email: row[emailColIdx] ? row[emailColIdx].toString().trim().toLowerCase() : "",
          productionUnit1: unit1,
          productionUnit2: unit2,
          status: status
        };
        
        Logger.log('Found student: ' + JSON.stringify(studentInfo));
        return studentInfo;
      }
    }
    
    return null; // Student not found
    
  } catch (error) {
    Logger.log('Error in getStudentFromMasterList: ' + error.toString());
    throw error;
  }
}

/**
 * Updated getUnitMembers to handle faculty access
 * Replace the existing function in your WebAppDeployment.js
 */

// eslint-disable-next-line no-unused-vars
function getUnitMembers(userInfo) {
  Logger.log('Getting unit members for: ' + userInfo.studentId);
  
  try {
    // If faculty, return all students from all units
    if (userInfo.productionUnit1 === 'FACULTY' || userInfo.studentId.startsWith('FACULTY_')) {
      return getAllActiveStudents();
    }
    
    // For students, continue with existing logic
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    
    if (!masterSheet) {
      throw new Error('Master student list sheet not found');
    }
    
    const data = masterSheet.getDataRange().getValues();
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    
    const idColIdx = headers.indexOf("studentId");
    const nameColIdx = headers.indexOf("studentName");
    const unit1ColIdx = headers.indexOf("unit1");
    const statusColIdx = headers.indexOf("status");
    
    const unitMembers = [];
    const targetUnit = userInfo.productionUnit1;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowStudentId = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
      const rowStudentName = row[nameColIdx] ? row[nameColIdx].toString().trim() : "";
      const rowStatus = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : "";
      
      // Skip inactive students and the current student
      if (rowStatus !== "active" && rowStatus !== "enrolled") continue;
      if (rowStudentId === userInfo.studentId) continue;
      
      // Check if this student is in the same unit
      let rowUnit1 = row[unit1ColIdx] ? row[unit1ColIdx].toString().trim().toUpperCase() : "";
      if (rowUnit1.startsWith("UNIT ") && rowUnit1.length > 5) {
        rowUnit1 = rowUnit1.substring(5, 6);
      }
      
      if (rowUnit1 === targetUnit && isValidProductionUnit(rowUnit1)) {
        unitMembers.push({
          studentId: rowStudentId,
          studentName: rowStudentName
        });
      }
    }
    
    Logger.log(`Found ${unitMembers.length} unit members for unit ${targetUnit}`);
    return unitMembers;
    
  } catch (error) {
    Logger.log('Error in getUnitMembers: ' + error.toString());
    throw error;
  }
}

/**
 * New helper function to get all active students (for faculty)
 */
function getAllActiveStudents() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName(PA_MASTER_STUDENT_LIST_SHEET_NAME);
    
    if (!masterSheet) {
      return [];
    }
    
    const data = masterSheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }
    
    const headers = data[0].map(h => h ? h.toString().trim() : "");
    const idColIdx = headers.indexOf("studentId");
    const nameColIdx = headers.indexOf("studentName");
    const statusColIdx = headers.indexOf("status");
    
    const allStudents = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowStudentId = row[idColIdx] ? row[idColIdx].toString().trim().toUpperCase() : null;
      const rowStudentName = row[nameColIdx] ? row[nameColIdx].toString().trim() : "";
      const rowStatus = row[statusColIdx] ? row[statusColIdx].toString().trim().toLowerCase() : "";
      
      // Only include active students
      if ((rowStatus === "active" || rowStatus === "enrolled") && rowStudentId) {
        allStudents.push({
          studentId: rowStudentId,
          studentName: rowStudentName
        });
      }
    }
    
    Logger.log(`Found ${allStudents.length} active students for faculty view`);
    return allStudents;
    
  } catch (error) {
    Logger.log('Error in getAllActiveStudents: ' + error.toString());
    return [];
  }
}

/**
 * Creates the student assessment interface (using your existing HTML structure)
 */
function createStudentAssessmentPage(userSession) {
  try {
    // Use the existing AssessmentInterface.html file
    const template = HtmlService.createTemplateFromFile('AssessmentInterface');
    
    // Make user session data available to the template
    template.userSession = userSession;
    template.studentName = userSession.studentName;
    template.studentId = userSession.studentId;
    template.productionUnit = userSession.productionUnit;
    
    return template.evaluate()
      .setTitle('Peer Assessment Portal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    Logger.log('Error creating student assessment page: ' + error.toString());
    return createErrorPage('Failed to load assessment interface: ' + error.toString());
  }
}

/**
 * Creates the instructor dashboard
 */
function createInstructorDashboard(userSession) {
  const template = HtmlService.createTemplate(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Peer Assessment - Instructor Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
        .stat-label { color: #666; margin-top: 5px; }
        .btn { background: #667eea; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; text-decoration: none; display: inline-block; }
        .btn:hover { background: #5a6fd8; }
        .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Instructor Dashboard</h1>
        <p>Welcome, <?= userEmail ?> | <a href="?action=logout" style="color: white;">Logout</a></p>
      </div>
      
      <div class="stats-grid" id="statsGrid">
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
        <div class="stat-card">
          <div class="stat-number" id="completionRate">Loading...</div>
          <div class="stat-label">Completion Rate</div>
        </div>
      </div>
      
      <div class="card">
        <h2>🔧 System Actions</h2>
        <div class="actions">
          <button class="btn" onclick="runWorkflow('analytics')">Generate Analytics</button>
          <button class="btn" onclick="runWorkflow('scoring')">Calculate Scores</button>
          <button class="btn" onclick="runWorkflow('reports')">Generate Reports</button>
          <button class="btn" onclick="runWorkflow('missing')">Find Missing Assessments</button>
          <button class="btn" onclick="openSpreadsheet()">Open Spreadsheet</button>
        </div>
      </div>
      
      <div class="card">
        <h2>📈 Quick Reports</h2>
        <div id="quickReports">Loading reports...</div>
      </div>
      
      <div class="card">
        <h2>⚙️ System Status</h2>
        <div id="systemStatus">Checking system status...</div>
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          loadDashboardData();
          loadQuickReports();
          checkSystemStatus();
        });
        
        async function loadDashboardData() {
          try {
            const stats = await new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .getSystemStatisticsSafe();
            });
            updateStats(stats);
          } catch (error) {
            console.error('Failed to load dashboard data:', error);
          }
        }
        
        function updateStats(stats) {
          document.getElementById('totalStudents').textContent = stats.totalStudents || '0';
          document.getElementById('totalResponses').textContent = stats.totalResponses || '0';
          document.getElementById('totalQuestions').textContent = stats.totalQuestions || '0';
          document.getElementById('completionRate').textContent = (stats.completionRate || 0) + '%';
        }
        
        async function runWorkflow(type) {
          const button = event.target;
          const originalText = button.textContent;
          button.textContent = 'Running...';
          button.disabled = true;
          
          try {
            switch(type) {
              case 'analytics':
                await new Promise((resolve, reject) => {
                  google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)
                    .generateEvaluatorAnalyticsAndWeights();
                });
                break;
              case 'scoring':
                await new Promise((resolve, reject) => {
                  google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)
                    .calculateWeightedScoresAndUpdateSheet();
                });
                break;
              case 'reports':
                await new Promise((resolve, reject) => {
                  google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)
                    .generateRawScoresReportWithWeights();
                });
                break;
              case 'missing':
                await new Promise((resolve, reject) => {
                  google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)
                    .findStudentsWhoHaventAssessedSpecificPeers();
                });
                break;
            }
            alert('Workflow completed successfully!');
            loadDashboardData();
          } catch (error) {
            alert('Workflow failed: ' + error.message);
          } finally {
            button.textContent = originalText;
            button.disabled = false;
          }
        }
        
        function openSpreadsheet() {
          window.open('<?= spreadsheetUrl ?>', '_blank');
        }
        
        async function loadQuickReports() {
          try {
            const reports = await new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .getQuickReports();
            });
            document.getElementById('quickReports').innerHTML = reports;
          } catch (error) {
            document.getElementById('quickReports').innerHTML = 'Failed to load reports';
          }
        }
        
        async function checkSystemStatus() {
          try {
            const status = await new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .getSystemStatus();
            });
            document.getElementById('systemStatus').innerHTML = formatSystemStatus(status);
          } catch (error) {
            document.getElementById('systemStatus').innerHTML = 'Failed to check system status';
          }
        }
        
        function formatSystemStatus(status) {
          let html = '<ul>';
          Object.entries(status).forEach(([key, value]) => {
            const statusIcon = value.status === 'ok' ? '✅' : '❌';
            html += \`<li>\${statusIcon} \${key}: \${value.message}</li>\`;
          });
          html += '</ul>';
          return html;
        }
      </script>
    </body>
    </html>
  `);
  
  template.userEmail = userSession.email;
  template.spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  
  return template.evaluate()
    .setTitle('Instructor Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Creates an authentication required page
 */
function createAuthenticationPage(errorMessage) {
  const html = HtmlService.createTemplate(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Required</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .error { color: #d73027; margin: 20px 0; padding: 15px; background: #fdf2f2; border-radius: 5px; }
        .btn { background: #4285f4; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px; }
        .icon { font-size: 3em; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🔐</div>
        <h1>Authentication Required</h1>
        <p>Please log in with your SHU Google account to access the Peer Assessment system.</p>
        
        <?= errorMessage ? '<div class="error">Error: ' + errorMessage + '</div>' : '' ?>
        
        <a href="https://accounts.google.com/signin" class="btn">Sign In with Google</a>
        
        <p style="margin-top: 30px; color: #666; font-size: 0.9em;">
          Make sure you're using your institutional email address ending with @mail.shu.edu.tw
        </p>
        
        <button onclick="window.location.reload()" class="btn" style="background: #6c757d;">
          Try Again
        </button>
      </div>
    </body>
    </html>
  `);
  
  html.errorMessage = errorMessage || '';
  
  return html.evaluate()
    .setTitle('Authentication Required')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Creates an error page
 */
function createErrorPage(errorMessage) {
  const html = HtmlService.createTemplate(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Application Error</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .error { color: #d73027; }
        .btn { background: #4285f4; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="error">❌ Application Error</h1>
        <p>Sorry, there was an error loading the application.</p>
        <div style="background: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace;">
          <?= errorMessage ?>
        </div>
        <a href="?" class="btn">Try Again</a>
        <a href="mailto:support@shu.edu.tw" class="btn">Contact Support</a>
      </div>
    </body>
    </html>
  `);
  
  html.errorMessage = errorMessage || 'Unknown error occurred';
  
  return html.evaluate()
    .setTitle('Application Error')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Creates a logout page
 */
function createLogoutPage() {
  const html = HtmlService.createTemplate(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logged Out</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .btn { background: #4285f4; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>👋 Logged Out</h1>
        <p>You have been successfully logged out of the Peer Assessment system.</p>
        <a href="?" class="btn">Sign In Again</a>
      </div>
    </body>
    </html>
  `);
  
  return html.evaluate()
    .setTitle('Logged Out')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Alternative assessment interface (if you want to use a separate HTML file)
 */
function createAssessmentInterface() {
  try {
    const userSession = getCurrentUserSession();
    
    if (!userSession.isAuthenticated) {
      return createAuthenticationPage(userSession.error);
    }
    
    // Use the existing AssessmentInterface.html file
    const template = HtmlService.createTemplateFromFile('AssessmentInterface');
    template.userSession = userSession;
    
    return template.evaluate()
      .setTitle('Peer Assessment Portal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    return createErrorPage(error.message);
  }
}

/**
 * Alternative instructor interface
 */
function createInstructorInterface() {
  try {
    const userSession = getCurrentUserSession();
    
    if (!userSession.isAuthenticated) {
      return createAuthenticationPage(userSession.error);
    }
    
    if (userSession.role !== 'instructor') {
      return createErrorPage('Access denied. This interface is for instructors only.');
    }
    
    return createInstructorDashboard(userSession);
    
  } catch (error) {
    return createErrorPage(error.message);
  }
}

// ===== API ENDPOINTS FOR FRONTEND =====

/**
 * API endpoint to get system statistics for instructor dashboard (SAFE VERSION)
 */
// eslint-disable-next-line no-unused-vars
function getSystemStatisticsSafe() {
  try {
    Logger.log('getSystemStatisticsSafe called from WebAppDeployment');
    
    const parsedData = parseRawSurveyData();
    if (!parsedData) {
      Logger.log('parseRawSurveyData returned null');
      return { 
        totalStudents: 0, 
        totalQuestions: 0, 
        totalResponses: 0,
        completionRate: 0,
        error: 'Failed to parse data' 
      };
    }
    
    const totalStudents = Object.keys(parsedData.students).length;
    const totalQuestions = Object.keys(parsedData.questions).length;
    const totalResponses = parsedData.responses.length;
    
    // Calculate completion rate
    const expectedResponses = totalStudents * totalQuestions * (totalStudents - 1);
    const completionRate = expectedResponses > 0 ? Math.round((totalResponses / expectedResponses) * 100) : 0;
    
    Logger.log(`System stats: ${totalStudents} students, ${totalQuestions} questions, ${totalResponses} responses, ${completionRate}% complete`);
    
    return {
      totalStudents,
      totalQuestions,
      totalResponses,
      completionRate: Math.min(completionRate, 100)
    };
    
  } catch (error) {
    Logger.log(`Error in getSystemStatisticsSafe: ${error.message}`);
    Logger.log(`Error stack: ${error.stack}`);
    return { 
      totalStudents: 0, 
      totalQuestions: 0, 
      totalResponses: 0,
      completionRate: 0,
      error: error.message 
    };
  }
}

/**
 * API endpoint to get quick reports HTML
 */

// eslint-disable-next-line no-unused-vars
function getQuickReports() {
  try {
    const parsedData = parseRawSurveyData();
    if (!parsedData) {
      return '<p>Failed to load data</p>';
    }
    
    const students = Object.values(parsedData.students);
    const unitCounts = {};
    students.forEach(student => {
      const unit = student.productionUnit1 || 'Unknown';
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });
    
    let html = '<h3>Students by Unit</h3><ul>';
    Object.entries(unitCounts).forEach(([unit, count]) => {
      html += `<li>Unit ${unit}: ${count} students</li>`;
    });
    html += '</ul>';
    
    const responseTypes = {};
    parsedData.responses.forEach(response => {
      responseTypes[response.responseType] = (responseTypes[response.responseType] || 0) + 1;
    });
    
    html += '<h3>Response Summary</h3><ul>';
    Object.entries(responseTypes).forEach(([type, count]) => {
      html += `<li>${type}: ${count} responses</li>`;
    });
    html += '</ul>';
    
    return html;
    
  } catch (error) {
    return `<p>Error loading reports: ${error.message}</p>`;
  }
}

/**
 * API endpoint to get system status
 */

// eslint-disable-next-line no-unused-vars
function getSystemStatus() {
  const status = {};
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const requiredSheets = [
      PA_MASTER_STUDENT_LIST_SHEET_NAME,
      PA_QUESTION_CONFIG_SHEET_NAME,
      PA_RAW_SUBMISSIONS_V2_SHEET_NAME
    ];
    
    requiredSheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      status[`Sheet: ${sheetName}`] = {
        status: sheet ? 'ok' : 'error',
        message: sheet ? 'Found' : 'Missing'
      };
    });
    
    try {
      const parsedData = parseRawSurveyData();
      status['Data Parsing'] = {
        status: parsedData ? 'ok' : 'error',
        message: parsedData ? 'Successful' : 'Failed'
      };
      
      if (parsedData) {
        status['Students Data'] = {
          status: Object.keys(parsedData.students).length > 0 ? 'ok' : 'warning',
          message: `${Object.keys(parsedData.students).length} students loaded`
        };
        
        status['Questions Data'] = {
          status: Object.keys(parsedData.questions).length > 0 ? 'ok' : 'warning',
          message: `${Object.keys(parsedData.questions).length} questions loaded`
        };
      }
    } catch (error) {
      status['Data Parsing'] = {
        status: 'error',
        message: error.message
      };
    }
    
  } catch (error) {
    status['System Check'] = {
      status: 'error',
      message: error.message
    };
  }
  
  return status;
}

/**
 * Include HTML files for templating (if using separate HTML files)
 */

// eslint-disable-next-line no-unused-vars
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== ADDITIONAL API ENDPOINTS NEEDED BY ASSESSMENTINTERFACE.HTML =====

/**
 * Wrapper function for getQuestionDefinitions to be called by frontend
 * This ensures compatibility with the existing AssessmentInterface.html
 */

// eslint-disable-next-line no-unused-vars
function getQuestionDefinitionsForFrontend() {
  try {
    return getQuestionDefinitions();
  } catch (error) {
    Logger.log('Error in getQuestionDefinitionsForFrontend: ' + error.toString());
    throw error;
  }
}

/**
 * Submit peer assessments from the frontend
 * This function receives the assessment data and processes it
 */

function handleAssessmentSubmission(e) {
  Logger.log('handleAssessmentSubmission called with ' + JSON.stringify(e.parameter));
  
  try {
    // Validate user session first
    const userSession = getCurrentUserSession();
    if (!userSession.isAuthenticated) {
      throw new Error('User not authenticated');
    }
    
    // Process the submission data
    const submissionData = JSON.parse(e.parameter.submissions || '[]');
    
    // Validate submissions array
    if (!Array.isArray(submissionData) || submissionData.length === 0) {
      throw new Error('No submissions provided');
    }
    
    // Validate that all submissions are from the current user
    const currentUserId = userSession.studentId;
    for (const submission of submissionData) {
      if (submission.evaluatorId !== currentUserId) {
        throw new Error('Submission contains evaluations from a different user');
      }
    }
    
    // Call the existing submitPeerAssessments function
    const result = submitPeerAssessments(submissionData);
    
    if (result.success) {
      return HtmlService.createHtmlOutput(`
        <script>
          alert('✅ Assessments submitted successfully!');
          window.location.href = '?';
        </script>
      `);
    } else {
      return HtmlService.createHtmlOutput(`
        <script>
          alert('❌ Submission failed: ${result.error}');
          history.back();
        </script>
      `);
    }
    
  } catch (error) {
    Logger.log('Error in handleAssessmentSubmission: ' + error.toString());
    return HtmlService.createHtmlOutput(`
      <script>
        alert('❌ Submission failed: ${error.toString()}');
        history.back();
      </script>
    `);
  }
}

/**
 * Alternative function name for backward compatibility
 * This ensures the frontend can call either function name
 */

// eslint-disable-next-line no-unused-vars
function submitAssessmentsToBackend(submissions) {
  return handleAssessmentSubmission({ parameter: { submissions: JSON.stringify(submissions) } });
}