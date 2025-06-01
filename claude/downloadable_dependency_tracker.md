# Peer Assessment System - Complete Codebase Documentation

> **Generated:** June 1, 2025  
> **Total Files:** 16 (14 JS + 2 HTML)  
> **Total Functions:** 61  
> **Architecture:** 7-layer dependency structure
> **Status:** CRITICAL DEPENDENCY VIOLATIONS FOUND

---

## 📁 Project Structure & Load Order

Based on `clasp.json` push order:

```
src/
├── Config.js                    # Layer 1: Constants ✅ PROVIDED
├── Utils.js                     # Layer 1: Utilities ✅ PROVIDED
├── Models.js                    # Layer 2: Data objects ✅ PROVIDED
├── Parser_V2.js                 # Layer 3: Data processing ✅ PROVIDED
├── SheetUtils.js                # Layer 4: Sheet management ✅ PROVIDED
├── UserTestingScript.js         # Layer 4: Test infrastructure ✅ PROVIDED
├── AuthHandler.js               # Layer 4: Authentication ✅ PROVIDED
├── MockDataGenerator.js         # Layer 4: Test data ✅ PROVIDED
├── SubmissionHandler.js         # Layer 4: Form processing ✅ PROVIDED
├── Workflow_Analytics.js        # Layer 5: Analytics ✅ PROVIDED
├── Workflow_Scoring.js          # Layer 5: Scoring ✅ PROVIDED
├── Workflow_Reporting.js        # Layer 5: Reporting ✅ PROVIDED
├── MainMenu.js                  # Layer 6: Menu system ✅ PROVIDED
└── WebAPI.js                    # Layer 6: Web coordination ✅ PROVIDED

rootDir/
├── Login.html                   # Layer 7: Auth UI ✅ PROVIDED
└── AssessmentInterface.html     # Layer 7: Main UI ✅ PROVIDED
```

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### 🔴 **CRITICAL DEPENDENCY VIOLATIONS** (Load Order Issues)
1. **Utils.js (file #2)** calls functions from files loaded AFTER it:
   - `parseRawSurveyData` from Parser_V2.js (file #4) 
   - `createQuestion` from Models.js (file #3)

2. **UserTestingScript.js (file #6)** calls functions from files loaded AFTER it:
   - `getStudentDetailsByEmail`, `getUnitMembers`, `checkIfInstructor`, `getAllActiveStudentsForFaculty` from AuthHandler.js (file #7)

### 🔴 **DEAD REFERENCES**
3. **Parser_V2.js** declares `createResponse` in globals but never uses it

### 🔴 **CIRCULAR REFERENCES**  
4. **AuthHandler.js** references `validateAssessmentPermission` which is defined in the same file

### 🔴 **CODE QUALITY ISSUES**
5. **UserTestingScript.js** uses `var` instead of `const/let` for global variables

### 🟡 **Medium Priority Issues**
6. **Function Redundancy**
   - `getQuestionDefinitions()` exists in Utils.js and Parser_V2.js
   - **Fix**: Remove Utils.js version, use Parser_V2.js as canonical

7. **Global Variables**
   - UserTestingScript.js uses `var` for test configuration
   - **Fix**: Use const/let and explicit exports

---

## 🏗️ Architecture Overview

### Layer 1: Foundation ✅ **COMPLETE**
- **Config.js**: 9 sheet name constants (PA_*_SHEET_NAME)
- **Utils.js**: Core validation, math, auth helper, and test functions

### Layer 2: Data Models ✅ **COMPLETE**
- **Models.js**: createStudent, createQuestion, createResponse factories

### Layer 3: Data Processing ✅ **COMPLETE**
- **Parser_V2.js**: parseRawSurveyData (core data provider)

### Layer 4: Utilities & Services ✅ **COMPLETE**
- **AuthHandler.js**: Complete authentication system
- **UserTestingScript.js**: Complete test infrastructure
- **MockDataGenerator.js**: Complete test data generation
- **SheetUtils.js**: Complete sheet utilities
- **SubmissionHandler.js**: Complete submission handler

### Layer 5: Business Logic ✅ **COMPLETE**
- **Workflow_Analytics.js**: generateEvaluatorAnalyticsAndWeights
- **Workflow_Scoring.js**: calculateWeightedScoresAndUpdateSheet
- **Workflow_Reporting.js**: 3 report functions

### Layer 6: Interface Backend ✅ **COMPLETE**
- **MainMenu.js**: Complete Google Sheets menu
- **WebAPI.js**: Complete web coordination

### Layer 7: Frontend ✅ **COMPLETE**
- **Login.html**: Complete authentication interface
- **AssessmentInterface.html**: Complete main assessment UI

---

## 🔗 Critical Dependencies Map

### **CRITICAL FUNCTIONS** (High Impact)

| Function | File | Status | Used By | Issues |
|----------|------|--------|---------|--------|
| `parseRawSurveyData()` | Parser_V2.js | ✅ WORKING | Workflow_Analytics, Workflow_Scoring, Workflow_Reporting, WebAPI | None |
| `getCurrentUserSession()` | AuthHandler.js | ✅ WORKING | WebAPI, UserTestingScript | None |
| `submitPeerAssessments()` | SubmissionHandler.js | ✅ WORKING | WebAPI, AssessmentInterface | None |
| `isValidProductionUnit()` | Utils.js | ✅ WORKING | 7 files across all layers | None |
| `isValidShuEmail()` | Utils.js | ✅ WORKING | 4 files (validation layer) | None |
| `generateEvaluatorAnalyticsAndWeights()` | Workflow_Analytics.js | ✅ WORKING | Workflow_Scoring, Workflow_Reporting | None |

### **GLOBAL VARIABLE DEPENDENCIES**

| Variable | Defined In | Used By | Status |
|----------|------------|---------|--------|
| `DEVELOPMENT_MODE` | UserTestingScript.js line 22 | AuthHandler.js line 13 | ✅ WORKING |
| `CURRENT_TEST_EMAIL` | UserTestingScript.js line 17 | AuthHandler.js line 14 | ✅ WORKING |
| `TEST_STUDENT_EMAILS` | UserTestingScript.js lines 10-15 | UserTestingScript.js functions | ✅ WORKING |

---

## 🛣️ Data Flow Diagrams

### Authentication Flow ✅ **WORKING**
```
WebAPI.doGet() → getCurrentUserSession() → AuthHandler checks test mode → Returns session
```

### Assessment Submission Flow ✅ **WORKING**
```
AssessmentInterface.html → submitPeerAssessments() → SubmissionHandler.js → PaRawSubmissionsV2 Sheet
```

### Analytics Flow ✅ **WORKING**
```
Raw Data → parseRawSurveyData() → Workflow_Analytics → Workflow_Scoring → Final Scores
```

### Menu Workflow ✅ **WORKING**
```
MainMenu.onOpen() → Google Sheets Menu → Workflow Functions → Output Sheets
```

---

## 📝 Complete Function Reference

### Config.js ✅
- **Constants Only**: 9 PA_*_SHEET_NAME constants

### Utils.js ✅ **EXTENDED VERSION**
- `isValidShuEmail(email)` → Enhanced with faculty support
- `extractStudentIdFromEmail(email)` → Enhanced with faculty IDs
- `isFacultyEmail(email)` → **NEW FUNCTION**
- `isValidProductionUnit(unit)` → Validation
- `calculateMedianFromArray(arr)` → Math
- `calculateMean(arr)` → Math  
- `calculateStdDev(arr, mean)` → Math
- `checkIfInstructor(email)` → **NEW AUTH HELPER**
- `getSystemStatisticsSafe()` → **NEW SAFE STATS**
- `getQuestionDefinitions()` → **REDUNDANT - TEST VERSION**
- `testGetQuestions()` → Testing
- `testNewParser()` → Testing

### Models.js ✅
- `createStudent(options)` → Factory
- `createQuestion(id, prompt, ...)` → Factory
- `createResponse(questionId, responseValue, ...)` → Factory

### Parser_V2.js ✅
- `getQuestionDefinitions()` → **CANONICAL VERSION**
- `parseRawSurveyData()` → **CORE DATA PROVIDER**

### AuthHandler.js ✅ **COMPREHENSIVE**
- `getCurrentUserSession()` → **MAIN AUTH FUNCTION**
- `getStudentDetailsByEmail(email)` → Enhanced lookup
- `getUnitMembers(unit, currentStudentId)` → Enhanced group lookup
- `validateAssessmentPermission(evaluatorId, evaluatedId)` → Permission validation
- `getUserStatistics()` → Enhanced analytics
- `getCurrentUser()` → Wrapper function
- `getSystemHealth()` → **NEW MONITORING**
- `getAllActiveStudentsForFaculty()` → **NEW FACULTY ACCESS**

### UserTestingScript.js ✅ **ENHANCED**
- **Global Variables**: DEVELOPMENT_MODE, CURRENT_TEST_EMAIL, TEST_STUDENT_EMAILS
- `createTestSessionFromRealStudent(testEmail)` → Real student test sessions
- `createFacultySession(email)` → **NEW FACULTY TESTING**
- `switchTestUser(email)` → Development utility
- `listTestUsers()` → Enhanced user listing
- `validateTestUsers()` → **NEW VALIDATION**
- `testCurrentConfiguration()` → **NEW TESTING**
- `disableTestMode()` → Development utility
- `enableTestMode(email)` → Development utility

### SubmissionHandler.js ✅ **ENHANCED**
- `submitPeerAssessments(submissions)` → **MAIN SUBMISSION HANDLER**
- `groupSubmissionsByEvaluatedStudent(submissions)` → **NEW ORGANIZATION**
- `validateAndFormatSubmission(submission)` → Enhanced validation
- `handleDuplicateSubmissions(newSubmissions, existingSubmissions)` → **NEW OVERWRITE HANDLING**
- `removeDuplicateSubmissions(sheet, toRemove)` → **NEW CLEANUP**
- `generateDetailedSubmissionSummary(submissions)` → **NEW ANALYTICS**
- `generateResponseId(submission, timestamp)` → Enhanced ID generation
- `getExistingSubmissions(sheet)` → **NEW PERFORMANCE OPTIMIZATION**
- `getAssessmentCompletionStatus(evaluatorId)` → **NEW STATUS TRACKING**

### WebAPI.js ✅ **COMPLETE**
- `doGet(e)` → **WEB APP ENTRY POINT**
- `doPost(e)` → POST handler
- `getCurrentUser()` → Frontend API (calls AuthHandler)
- `getQuestionDefinitionsForWeb()` → **NEW WEB-SAFE QUESTIONS**
- `createStudentInterface(userSession)` → Interface generation
- `createInstructorInterface(userSession)` → **NEW INSTRUCTOR DASHBOARD**
- `createAuthenticationInterface(errorMessage)` → Interface generation
- `createErrorInterface(errorMessage)` → Interface generation
- `getSystemStatisticsSafe()` → **NEW SAFE STATISTICS**
- `debugFunctionAvailability()` → **NEW DEBUG UTILITY**

### **Frontend HTML Files** ✅ **COMPLETE**
**Login.html**: Complete authentication interface with:
- Google authentication integration
- Manual email validation
- SHU email format checking
- Enhanced UI with animations
- Error/success messaging
- Responsive design

**AssessmentInterface.html**: Complete assessment interface with:
- Student selection dropdown
- Faculty mode with unit filtering
- Real-time assessment form
- Progress tracking
- Submission handling
- Debug panel for troubleshooting

### Other Files ✅
- **SheetUtils.js**: 7 sheet clearing functions
- **MockDataGenerator.js**: 1 test data generation function
- **Workflow_Analytics.js**: 1 analytics generation function
- **Workflow_Scoring.js**: 1 scoring calculation function  
- **Workflow_Reporting.js**: 3 report generation functions
- **MainMenu.js**: 1 menu creation function (onOpen)

---

## 🚨 DEBUGGING PRIORITY LIST

### 🔴 **CRITICAL FIXES NEEDED** (System will not work)
1. **Fix Utils.js load order** - Move functions that depend on later files OR reorganize clasp.json
2. **Fix UserTestingScript.js load order** - Move functions that depend on AuthHandler.js  
3. **Remove dead reference** - Delete `createResponse` from Parser_V2.js globals
4. **Fix circular reference** - Remove `validateAssessmentPermission` from AuthHandler.js globals

### 🟡 **MEDIUM PRIORITY**  
5. **Fix variable declarations** - Change `var` to `const/let` in UserTestingScript.js
6. **Remove duplicate function** - Delete `getQuestionDefinitions()` from Utils.js

### 🟢 **LOW PRIORITY**
7. **Clean up unused references**
8. **Add error boundaries** for better debugging

---

## 🔧 CURRENT WORKING COMPONENTS

### ✅ **FULLY FUNCTIONAL** 
- Google Sheets menu system (MainMenu.js)
- Authentication with test mode (AuthHandler.js + UserTestingScript.js)
- Data parsing and validation (Parser_V2.js + Utils.js + Models.js)
- All workflow functions (Analytics, Scoring, Reporting)
- Sheet management utilities (SheetUtils.js)
- Mock data generation (MockDataGenerator.js)
- Assessment submission system (SubmissionHandler.js)
- Complete web interface (WebAPI.js + Login.html + AssessmentInterface.html)

### ⚠️ **NEEDS TESTING**
- End-to-end web workflow
- Template variable passing between WebAPI and HTML
- Duplicate function cleanup

### ❌ **CRITICAL ISSUES**
- Load order dependency violations in Utils.js and UserTestingScript.js
- System will fail to load due to undefined function references
- Dead and circular references causing potential runtime errors

**SYSTEM STATUS: BROKEN - REQUIRES DEPENDENCY FIXES** ❌

---

## 💾 RECOVERY ACTIONS NEEDED

**CRITICAL: System has load order dependency violations that prevent it from working**

1. **Fix Utils.js dependencies** - Functions call `parseRawSurveyData` and `createQuestion` before they're loaded
2. **Fix UserTestingScript.js dependencies** - Functions call AuthHandler.js functions before AuthHandler loads  
3. **Clean up dead references** - Remove unused `createResponse` global in Parser_V2.js
4. **Fix circular reference** - Remove self-referencing global in AuthHandler.js
5. **Test system after dependency fixes**

**SYSTEM STATUS: REQUIRES CLASP LOAD ORDER FIXES** ❌

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
- Complete source code (16 files)
- clasp.json (load order)
- Google Sheets with data structure

### Key Configuration
- Sheet names in Config.js
- Test users in UserTestingScript.js  
- Menu structure in MainMenu.js
- Web app deployment settings

---

*This documentation reflects the ACTUAL state of the provided codebase as of June 1, 2025.*