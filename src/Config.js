/* eslint-disable no-unused-vars */
// Meaningless comment
/**
 * @file Config.js
 * @description This file defines global constants for the Peer Assessment system.
 * All helper functions have been moved to Utils.js to maintain clean separation of concerns.
 * This file must be loaded FIRST in clasp.json.
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