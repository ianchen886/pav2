# Peer Assessment System - Complete Codebase Documentation

> **Generated:** January 19, 2025  
> **Total Files:** 15 (13 JS + 2 HTML)  
> **Total Functions:** 61  
> **Architecture:** 7-layer dependency structure

---

## 📁 Project Structure & Load Order

Based on `clasp.json` push order:

```
src/
├── Config.js                    # Layer 1: Constants
├── Utils.js                     # Layer 1: Utilities  
├── Models.js                    # Layer 2: Data objects
├── Parser_V2.js                 # Layer 3: Data processing
├── SheetUtils.js                # Layer 4: Sheet management
├── UserTestingScript.js         # Layer 4: Test infrastructure
├── AuthHandler.js               # Layer 4: Authentication
├── MockDataGenerator.js         # Layer 4: Test data
├── SubmissionHandler.js         # Layer 4: Form processing
├── Workflow_Analytics.js        # Layer 5: Analytics
├── Workflow_Scoring.js          # Layer 5: Scoring
├── Workflow_Reporting.js        # Layer 5: Reporting
├── MainMenu.js                  # Layer 6: Menu system
├── WebAPI.js                    # Layer 6: Web coordination
├── Login.html                   # Layer 7: Auth UI
└── AssessmentInterface.html     # Layer 7: Main UI
```

---

## 🏗️ Architecture Overview

### Layer 1: Foundation
- **Config.js**: 9 sheet name constants (PA_*_SHEET_NAME)
- **Utils.js**: Core validation and math functions

### Layer 2: Data Models  
- **Models.js**: createStudent, createQuestion, createResponse factories

### Layer 3: Data Processing
- **Parser_V2.js**: parseRawSurveyData (core data provider)

### Layer 4: Utilities & Services
- **AuthHandler.js**: getCurrentUserSession (authentication hub)
- **SubmissionHandler.js**: submitPeerAssessments (form handler)
- **UserTestingScript.js**: Test mode infrastructure
- **MockDataGenerator.js**: Test data generation
- **SheetUtils.js**: Sheet clearing utilities

### Layer 5: Business Logic
- **Workflow_Analytics.js**: Evaluator weights calculation
- **Workflow_Scoring.js**: Final score computation  
- **Workflow_Reporting.js**: Report generation

### Layer 6: Interface Backend
- **MainMenu.js**: Google Sheets menu (onOpen)
- **WebAPI.js**: Web app entry points (doGet/doPost)

### Layer 7: Frontend
- **Login.html**: Authentication interface
- **AssessmentInterface.html**: Main assessment UI

---

## 🔗 Critical Dependencies Map

### Most Important Functions (High Impact)

| Function | File | Used By | Impact Level |
|----------|------|---------|--------------|
| `parseRawSurveyData()` | Parser_V2.js | Workflow_Analytics, Workflow_Scoring, Workflow_Reporting, WebAPI | **CRITICAL** |
| `getCurrentUserSession()` | AuthHandler.js | WebAPI, Frontend interfaces | **CRITICAL** |
| `submitPeerAssessments()` | SubmissionHandler.js | WebAPI, AssessmentInterface | **CRITICAL** |
| `isValidProductionUnit()` | Utils.js | 7 files across all layers | **HIGH** |
| `isValidShuEmail()` | Utils.js | 4 files (validation layer) | **HIGH** |
| `generateEvaluatorAnalyticsAndWeights()` | Workflow_Analytics.js | Workflow_Scoring, Workflow_Reporting | **HIGH** |

### Cross-Layer Dependencies

```
Config.js → ALL FILES (sheet names)
Utils.js → Models, Parser_V2, Auth, Submission, Workflows  
Models.js → Parser_V2, MockDataGenerator
Parser_V2.js → Workflows, WebAPI
AuthHandler.js → WebAPI, UserTesting, Submission
SubmissionHandler.js → WebAPI, AssessmentInterface
WebAPI.js → Frontend interfaces
```

---

## 🚨 Known Issues & Recommendations

### 🔴 High Priority
1. **Circular Dependencies**
   - Utils.js ↔ Models.js (testing functions)
   - Utils.js ↔ Parser_V2.js (testing functions)
   - **Fix**: Move test functions to separate TestUtils.js

### 🟡 Medium Priority  
2. **Function Redundancy**
   - `getQuestionDefinitions()` exists in Utils.js and Parser_V2.js
   - **Fix**: Remove Utils.js version, use Parser_V2.js as canonical

3. **Global Variables**
   - UserTestingScript.js uses `var` for test configuration
   - **Fix**: Use const/let and explicit exports

---

## 🛣️ Data Flow Diagrams

### Authentication Flow
```
Login.html → AuthHandler.getCurrentUserSession() → WebAPI.doGet() → AssessmentInterface.html
```

### Assessment Submission Flow  
```
AssessmentInterface.html → SubmissionHandler.submitPeerAssessments() → PaRawSubmissionsV2 Sheet
```

### Analytics Flow
```
Raw Data → Parser_V2.parseRawSurveyData() → Workflow_Analytics → Evaluator Weights → Workflow_Scoring → Final Scores
```

### Menu Workflow
```
MainMenu.onOpen() → Google Sheets Menu → Workflow Functions → Output Sheets
```

---

## 🧪 Development & Testing

### Test Mode Setup
1. **Configure**: Set `DEVELOPMENT_MODE = true` in UserTestingScript.js
2. **Select User**: Set `CURRENT_TEST_EMAIL` to desired test email
3. **Available Test Users**: See `TEST_STUDENT_EMAILS` array
4. **Validation**: Run `validateTestUsers()` to check setup

### Test Functions Available
```javascript
// Data Testing
testGetQuestions()           // Test question loading
testNewParser()             // Test V2 parser
populateMockPaRawSubmissionsV2()  // Generate test data

// User Testing  
listTestUsers()             // List available test users
validateTestUsers()         // Validate test configuration
testCurrentConfiguration()  // Test current setup
switchTestUser(email)       // Change test user

// Sheet Management
clearALLOutputSheets()      // Clear all output sheets
```

### Development Workflow
1. Enable test mode → UserTestingScript.js
2. Generate test data → MockDataGenerator.js  
3. Test parsing → Utils.js test functions
4. Test workflows → Menu items or direct function calls
5. Test web interface → Access via WebAPI with test users
6. Clean up → SheetUtils clearing functions

---

## 📊 Change Impact Reference

### High-Risk Changes
- **Config.js**: Affects ALL files
- **Utils.js validation functions**: Affects data integrity across system
- **Parser_V2.js**: Affects all workflow functions
- **AuthHandler.js**: Affects entire web interface

### Medium-Risk Changes
- **Models.js**: Affects data object creation
- **SubmissionHandler.js**: Affects form submissions
- **WebAPI.js**: Affects web interface coordination

### Low-Risk Changes
- **Workflow functions**: Mostly isolated
- **Frontend HTML**: UI only
- **SheetUtils.js**: Utility functions only
- **UserTestingScript.js**: Testing only

---

## 📝 Complete Function Reference

### Config.js
- **Constants Only**: PA_*_SHEET_NAME (9 constants)

### Utils.js
- `isValidShuEmail(email)` → Validation
- `extractStudentIdFromEmail(email)` → Parsing
- `isValidProductionUnit(unit)` → Validation
- `calculateMedianFromArray(arr)` → Math
- `calculateMean(arr)` → Math  
- `calculateStdDev(arr, mean)` → Math
- `getQuestionDefinitions()` → **REDUNDANT**
- `testGetQuestions()` → Testing
- `testNewParser()` → Testing

### Models.js
- `createStudent(options)` → Factory
- `createQuestion(id, prompt, ...)` → Factory
- `createResponse(questionId, responseValue, ...)` → Factory

### Parser_V2.js
- `getQuestionDefinitions()` → **CANONICAL VERSION**
- `parseRawSurveyData()` → **CORE DATA PROVIDER**

### AuthHandler.js
- `getCurrentUserSession()` → **MAIN AUTH FUNCTION**
- `getStudentDetailsByEmail(email)` → Lookup
- `getUnitMembers(unit, currentStudentId)` → Group lookup
- `validateAssessmentPermission(evaluatorId, evaluatedId)` → Validation
- `getUserStatistics()` → Analytics
- `getCurrentUser()` → Wrapper function
- `getSystemHealth()` → Monitoring
- `getAllActiveStudentsForFaculty()` → Faculty access

### SubmissionHandler.js
- `submitPeerAssessments(submissions)` → **MAIN SUBMISSION HANDLER**
- `groupSubmissionsByEvaluatedStudent(submissions)` → Utility
- `getAssessmentCompletionStatus(evaluatorId)` → Status
- + 6 internal helper functions

### UserTestingScript.js
- **Global Variables**: DEVELOPMENT_MODE, CURRENT_TEST_EMAIL, TEST_STUDENT_EMAILS
- `createTestSessionFromRealStudent(testEmail)` → Test session creation
- `createFacultySession(email)` → Faculty test session
- `switchTestUser(email)` → Development utility
- `listTestUsers()` → Development utility
- `validateTestUsers()` → Development utility
- `testCurrentConfiguration()` → Development utility
- `disableTestMode()` → Development utility
- `enableTestMode(email)` → Development utility

### WebAPI.js
- `doGet(e)` → **WEB APP ENTRY POINT**
- `doPost(e)` → POST handler
- `getCurrentUser()` → Frontend API
- `getQuestionDefinitionsForWeb()` → Frontend API
- `createStudentInterface(userSession)` → Interface generation
- `createInstructorInterface(userSession)` → Interface generation
- `createAuthenticationInterface(errorMessage)` → Interface generation
- `createErrorInterface(errorMessage)` → Interface generation
- `getSystemStatisticsSafe()` → Statistics API
- `debugFunctionAvailability()` → Debug utility

### Frontend HTML Files
**Login.html**: 10+ JavaScript functions for authentication flow
**AssessmentInterface.html**: 18+ JavaScript functions for assessment interface

### Other Files
**SheetUtils.js**: 7 sheet clearing functions
**MockDataGenerator.js**: 1 test data generation function
**Workflow_Analytics.js**: 1 analytics generation function
**Workflow_Scoring.js**: 1 scoring calculation function  
**Workflow_Reporting.js**: 3 report generation functions
**MainMenu.js**: 1 menu creation function (onOpen)

---

## 🔧 Maintenance Instructions

### When Adding New Features
1. **Check this documentation** for impact analysis
2. **Follow the layer structure** - add to appropriate layer
3. **Update dependencies** - document new cross-file calls
4. **Test thoroughly** - use test mode infrastructure
5. **Update this document** - add new functions and dependencies

### When Modifying Existing Code
1. **Check "Critical Dependencies"** section first
2. **Review "Change Impact Reference"** for risk level
3. **Test all dependent functions** after changes
4. **Update documentation** if function signatures change

### When Debugging Issues
1. **Follow data flow diagrams** to trace issues
2. **Check dependency map** to find related functions
3. **Use test mode** to isolate problems
4. **Reference function list** for complete system overview

---

## 💾 Backup Information

### Essential Files to Maintain
- This documentation file
- Complete source code (15 files)
- clasp.json (load order)
- Google Sheets with data structure

### Key Configuration
- Sheet names in Config.js
- Test users in UserTestingScript.js  
- Menu structure in MainMenu.js
- Web app deployment settings

---

*This documentation was auto-generated from complete codebase analysis. Keep it updated as your system evolves!*