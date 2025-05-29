/* global PA_EVALUATOR_ANALYTICS_SHEET_NAME, parseRawSurveyData, calculateMedianFromArray, calculateMean, calculateStdDev */

/**
 * @file Workflow_Analytics.js
 * @description This file orchestrates the generation of evaluator analytics and calculates
 * evaluator weights based on peer assessment submission data. It reads parsed data,
 * computes various metrics about each evaluator's behavior (e.g., average scores given,
 * consistency, comment frequency), and then applies a weighting algorithm.
 * The results, including analytics and calculated weights, are outputted to the
 * 'PaEvaluatorAnalytics' Google Sheet. This function is typically invoked from the
 * custom menu in Google Sheets.
 *
 * @requires Config.gs (for PA_EVALUATOR_ANALYTICS_SHEET_NAME)
 * @requires Parser_V2.js (for parseRawSurveyData function)
 * @requires Utils.js (for calculateMedianFromArray, calculateMean, calculateStdDev functions)
 */

/**
 * Generates detailed analytics for each evaluator based on their submitted peer assessments
 * and calculates a "weight" for each evaluator.
 *
 * The process involves:
 * 1. Parsing raw submission data using {@link parseRawSurveyData}.
 * 2. Initializing metrics for each active student (potential evaluator).
 * 3. Aggregating basic data: scores given, comments made, etc.
 * 4. Calculating group medians for items to enable deviation metrics.
 * 5. Calculating advanced metrics: average score, standard deviation of scores,
 *    score range, percentage of max/min/mid scores, intra-peer consistency (standard deviation),
 *    average deviation from group median for items, comment frequency, and average comment length.
 * 6. Applying a heuristic algorithm to calculate an evaluator weight (0.0 to 1.0)
 *    based on these metrics, aiming to adjust for potential biases or rating styles.
 * 7. Outputting all calculated analytics and weights to the 'PaEvaluatorAnalytics' sheet.
 *
 * This function is web-safe and can be called from both menu items and web interfaces.
 *
 * @function generateEvaluatorAnalyticsAndWeights
 * @returns {Object<string, number>|null} An object where keys are evaluator student IDs and values
 *                                        are their calculated weights (e.g., `{ "S123...": 0.85, ... }`).
 *                                        Returns `null` if critical errors occur (e.g., data parsing failure).
 */
// eslint-disable-next-line no-unused-vars
function generateEvaluatorAnalyticsAndWeights() {
  // ✅ REMOVED: const ui = SpreadsheetApp.getUi(); - This was causing the web context error
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- Starting Evaluator Analytics & Weight Generation (Web-Safe Version) ---");

  const analyticsSheetName = PA_EVALUATOR_ANALYTICS_SHEET_NAME; 

  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses || !parsedData.questions ) {
    // ✅ FIXED: Replaced ui.alert() with Logger.log() and throw error for web interface to handle
    Logger.log("ERROR: parseRawSurveyData did not return expected data for analytics.");
    throw new Error("Could not parse necessary data. Cannot generate analytics.");
  }

  const { students: allStudents, questions: _questions, responses } = parsedData;

  Logger.log(`Analytics - Parsed Students Count: ${Object.keys(allStudents).length}`);
  Logger.log(`Analytics - Parsed Responses Count: ${responses.length}`);

  if (Object.keys(allStudents).length === 0 ) {
    // ✅ FIXED: Replaced ui.alert() with Logger.log() and throw error
    Logger.log("ERROR: No student data found for analytics.");
    throw new Error("No student data found for analytics.");
  }

  let reportSheet = ss.getSheetByName(analyticsSheetName);
  if (reportSheet) { 
    reportSheet.clearContents().clearFormats(); 
  } else { 
    reportSheet = ss.insertSheet(analyticsSheetName); 
  }
  Logger.log(`Prepared sheet "${analyticsSheetName}".`);

  const analyticsHeaders = [
    "evaluatorId", "evaluatorName", "totalScoredAssessments", "avgScoreGiven", "stdDevScoresGiven", 
    "distinctScoresUsed", "rangeOfScoresUsed", "percentMaxScore", "percentMinScore", "percentMidScores",
    "avgIntraPeerSd", "avgAbsDevFromGroupMedian", "totalComments", "percentScoresWithComment", "avgCommentLength",
    "calculatedWeight"
  ];
  
  reportSheet.getRange(1, 1, 1, analyticsHeaders.length).setValues([analyticsHeaders]);
  reportSheet.getRange(1, 1, 1, analyticsHeaders.length).setFontWeight("bold").setHorizontalAlignment("center");
  reportSheet.setFrozenRows(1);
  Logger.log(`Populated camelCase headers in "${analyticsSheetName}".`);

  let evaluatorMetrics = {}; 
  for (const studentId in allStudents) {
    if (Object.prototype.hasOwnProperty.call(allStudents, studentId) && allStudents[studentId] && 
        !studentId.startsWith("UNKNOWNID_") && /^[A-Z]{1}[0-9]{9}$/.test(studentId)) {
      evaluatorMetrics[studentId] = {
        studentId: studentId,
        studentName: allStudents[studentId].studentName || `[Name missing for ${studentId}]`, 
        scoresGivenValues: [], commentsMadeCount: 0, assessmentsWhereCommentProvided: 0, 
        totalScoredAssessments: 0, commentLengths: [],
        distinctScoreValuesUsed: new Set(),
        absDeviationsFromGroupMedianArray: [] 
      };
    }
  }
  Logger.log(`Initialized evaluatorMetrics for ${Object.keys(evaluatorMetrics).length} potential evaluators.`);
  
  let scoreCommentPairTracker = {}; 
  responses.forEach(response => {
    if (!response.responseByStudentId || !evaluatorMetrics[response.responseByStudentId]) {
      return; 
    }
    const evaluatorId = response.responseByStudentId;
    if (!response.evaluatedStudentId || !response.responseToQuestionId) return; 
    const evalKey = `${evaluatorId}_${response.evaluatedStudentId}_${response.responseToQuestionId}`;

    if (response.responseType === "SCORE" && typeof response.responseValue === 'number' && !isNaN(response.responseValue)) {
      evaluatorMetrics[evaluatorId].scoresGivenValues.push(response.responseValue);
      evaluatorMetrics[evaluatorId].totalScoredAssessments++;
      evaluatorMetrics[evaluatorId].distinctScoreValuesUsed.add(response.responseValue);
      if (!scoreCommentPairTracker[evalKey]) scoreCommentPairTracker[evalKey] = { hasScore: false, hasComment: false };
      scoreCommentPairTracker[evalKey].hasScore = true;
    } else if (response.responseType === "COMMENT" && typeof response.responseValue === 'string' && response.responseValue.trim() !== "") {
      evaluatorMetrics[evaluatorId].commentsMadeCount++;
      evaluatorMetrics[evaluatorId].commentLengths.push(response.responseValue.trim().length);
      if (!scoreCommentPairTracker[evalKey]) scoreCommentPairTracker[evalKey] = { hasScore: false, hasComment: false };
      scoreCommentPairTracker[evalKey].hasComment = true;
    }
  });

  for (const key in scoreCommentPairTracker) {
    if (Object.prototype.hasOwnProperty.call(scoreCommentPairTracker, key)) {
      const parts = key.split('_');
      const evaluatorId = parts[0];
      if (!evaluatorMetrics[evaluatorId]) continue; 
      const pair = scoreCommentPairTracker[key];
      if (pair.hasScore && pair.hasComment) { 
          evaluatorMetrics[evaluatorId].assessmentsWhereCommentProvided++;
      }
    }
  }
  Logger.log("Analytics: Basic response aggregation complete.");

  // --- Calculate group medians for deviation metric ---
  let scoresByItemFromOthers = {}; 
  responses.forEach(r1 => {
      if (r1.responseType === "SCORE" && typeof r1.responseValue === 'number' && r1.evaluatedStudentId && r1.responseToQuestionId && r1.responseByStudentId) {
          const itemKey = `${r1.evaluatedStudentId}_${r1.responseToQuestionId}`;
          if (!scoresByItemFromOthers[itemKey]) scoresByItemFromOthers[itemKey] = [];
          
          responses.forEach(r2 => { 
              if (r2.responseByStudentId && r2.responseByStudentId !== r1.responseByStudentId &&
                  r2.evaluatedStudentId === r1.evaluatedStudentId &&
                  r2.responseToQuestionId === r1.responseToQuestionId && 
                  r2.responseType === "SCORE" && typeof r2.responseValue === 'number' && !isNaN(r2.responseValue)) { 
                  scoresByItemFromOthers[itemKey].push(r2.responseValue);
              }
          });
      }
  });

  let groupMediansByItem = {}; 
  for(const itemKey in scoresByItemFromOthers){
    if (Object.prototype.hasOwnProperty.call(scoresByItemFromOthers, itemKey)) {
      const uniqueScores = [...new Set(scoresByItemFromOthers[itemKey])];
      if (uniqueScores.length > 0) {
        groupMediansByItem[itemKey] = calculateMedianFromArray(uniqueScores); 
      }
    }
  }
  Logger.log("Analytics: Group medians for deviation metric calculated.");
  
  // --- Calculate advanced metrics for each evaluator ---
  for (const evaluatorId in evaluatorMetrics) {
    if (Object.prototype.hasOwnProperty.call(evaluatorMetrics, evaluatorId)) {
      const metrics = evaluatorMetrics[evaluatorId];
      
      if (metrics.scoresGivenValues.length > 0) {
          metrics.avgScoreGiven = calculateMean(metrics.scoresGivenValues);
          metrics.stdDevScoresGiven = metrics.scoresGivenValues.length >= 2 ? calculateStdDev(metrics.scoresGivenValues, metrics.avgScoreGiven) : 0;
          const minVal = Math.min(...metrics.scoresGivenValues);
          const maxVal = Math.max(...metrics.scoresGivenValues);
          metrics.rangeScoresUsed = maxVal - minVal;
          const MAX_POSSIBLE_SCORE = 4;
          const MIN_POSSIBLE_SCORE = 1;
          metrics.percentMaxScore = (metrics.scoresGivenValues.filter(s => s === MAX_POSSIBLE_SCORE).length / metrics.scoresGivenValues.length) * 100;
          metrics.percentMinScore = (metrics.scoresGivenValues.filter(s => s === MIN_POSSIBLE_SCORE).length / metrics.scoresGivenValues.length) * 100;
          metrics.percentMidScores = (metrics.scoresGivenValues.filter(s => s > MIN_POSSIBLE_SCORE && s < MAX_POSSIBLE_SCORE).length / metrics.scoresGivenValues.length) * 100;
      } else {
          metrics.avgScoreGiven = 0; 
          metrics.stdDevScoresGiven = 0; 
          metrics.rangeScoresUsed = 0;
          metrics.percentMaxScore = 0; 
          metrics.percentMinScore = 0; 
          metrics.percentMidScores = 0;
      }

      let intraPeerStdDevsAccumulator = []; 
      let perPeerScoresGiven = {}; 
      responses.forEach(r => {
          if (r.responseByStudentId === evaluatorId && r.responseType === "SCORE" && typeof r.responseValue === 'number' && r.evaluatedStudentId) {
              if (!perPeerScoresGiven[r.evaluatedStudentId]) perPeerScoresGiven[r.evaluatedStudentId] = [];
              perPeerScoresGiven[r.evaluatedStudentId].push(r.responseValue);
          }
      });
      for (const peerId in perPeerScoresGiven) {
          if (Object.prototype.hasOwnProperty.call(perPeerScoresGiven, peerId)) {
            if (perPeerScoresGiven[peerId].length >= 2) { 
                intraPeerStdDevsAccumulator.push(calculateStdDev(perPeerScoresGiven[peerId]));
            }
          }
      }
      metrics.avgIntraPeerSd = intraPeerStdDevsAccumulator.length > 0 ? calculateMean(intraPeerStdDevsAccumulator) : 0;
      
      let absDeviationsTempArray = []; 
      responses.forEach(r => {
          if (r.responseByStudentId === evaluatorId && r.responseType === "SCORE" && typeof r.responseValue === 'number' && r.evaluatedStudentId && r.responseToQuestionId) {
              const itemKey = `${r.evaluatedStudentId}_${r.responseToQuestionId}`;
              if (groupMediansByItem[itemKey] !== undefined && typeof groupMediansByItem[itemKey] === 'number') { 
                  absDeviationsTempArray.push(Math.abs(r.responseValue - groupMediansByItem[itemKey]));
              }
          }
      });
      metrics.avgAbsDevFromGroupMedian = absDeviationsTempArray.length > 0 ? calculateMean(absDeviationsTempArray) : 0;
      
      metrics.percentScoresWithComment = metrics.totalScoredAssessments > 0 ? (metrics.assessmentsWhereCommentProvided / metrics.totalScoredAssessments) * 100 : 0;
      metrics.avgCommentLength = metrics.commentLengths.length > 0 ? calculateMean(metrics.commentLengths) : 0;
    }
  }
  Logger.log(`Analytics: Advanced metrics calculated for all evaluators.`);

  // --- Calculate Evaluator Weights ---
  let evaluatorWeights = {}; 
  Logger.log("Analytics: Calculating evaluator weights...");
  for (const evaluatorId in evaluatorMetrics) {
    if (Object.prototype.hasOwnProperty.call(evaluatorMetrics, evaluatorId)) {
      const metrics = evaluatorMetrics[evaluatorId];
      let weight = 1.0; 
      const numScoresGiven = metrics.scoresGivenValues.length;

      if (numScoresGiven === 0) {
          weight = 0.0;
      } else if (numScoresGiven < 5) { 
          weight = 0.4; 
      } else { 
          if (metrics.avgScoreGiven > 3.5) weight -= 0.25;  
          else if (metrics.avgScoreGiven > 3.2) weight -= 0.15; 
          if (metrics.avgScoreGiven < 2.0) weight -= 0.25;  
          else if (metrics.avgScoreGiven < 2.3) weight -= 0.15; 
          
          if (metrics.percentMaxScore > 70) weight -= 0.10; 
          if (metrics.percentMaxScore > 90) weight -= 0.15;
          
          if (metrics.percentMinScore < 10 && metrics.avgScoreGiven > 3.2) weight -= 0.10;
          
          if (metrics.distinctScoreValuesUsed.size === 1) weight -= 0.30; 
          else if (metrics.distinctScoreValuesUsed.size === 2) weight -= 0.20;
          
          if (metrics.distinctScoreValuesUsed.size >= 3 && metrics.stdDevScoresGiven < 0.50 && metrics.scoresGivenValues.length >=10) weight -= 0.10;
          
          if (metrics.avgIntraPeerSd < 0.25 && metrics.totalScoredAssessments >= 10) weight -= 0.15;
          
          if (metrics.avgAbsDevFromGroupMedian > 0.70 && numScoresGiven >= 10) weight -= 0.15;
          
          if (metrics.percentScoresWithComment > 30) weight += 0.05;
          if (metrics.percentScoresWithComment > 50) weight += 0.05;
      }

      weight = Math.max(0.0, Math.min(1.0, weight));
      
      if (numScoresGiven > 0 && weight < 0.4 && weight !== 0.0) {
          weight = 0.4; 
      }

      metrics.calculatedWeight = parseFloat(weight.toFixed(3)); 
      evaluatorWeights[evaluatorId] = metrics.calculatedWeight; 
    }
  }
  Logger.log("Analytics: Evaluator weights calculated.");

  // --- Prepare Data Rows for Output Sheet ---
  let outputDataRows = [];
  const evaluatorIdsFromMetrics = Object.keys(evaluatorMetrics);

  const sortedEvaluatorIdsForReport = evaluatorIdsFromMetrics.sort((a, b) => {
      const metricA = evaluatorMetrics[a];
      const metricB = evaluatorMetrics[b];
      const aName = (metricA && typeof metricA.studentName === 'string' && metricA.studentName) ? metricA.studentName : a; 
      const bName = (metricB && typeof metricB.studentName === 'string' && metricB.studentName) ? metricB.studentName : b; 
      return aName.localeCompare(bName);
  });

  for (const evaluatorId of sortedEvaluatorIdsForReport) {
    const metrics = evaluatorMetrics[evaluatorId];
    outputDataRows.push([
      evaluatorId, 
      metrics.studentName || `[Name for ${evaluatorId}]`,
      metrics.totalScoredAssessments || 0, 
      (typeof metrics.avgScoreGiven === 'number' && metrics.scoresGivenValues.length > 0) ? metrics.avgScoreGiven.toFixed(2) : "N/A",
      (typeof metrics.stdDevScoresGiven === 'number' && metrics.scoresGivenValues.length > 1) ? metrics.stdDevScoresGiven.toFixed(2) : "N/A",
      metrics.distinctScoreValuesUsed ? metrics.distinctScoreValuesUsed.size : 0,
      (typeof metrics.rangeScoresUsed === 'number' && metrics.scoresGivenValues.length > 0) ? metrics.rangeScoresUsed : "N/A",
      (typeof metrics.percentMaxScore === 'number' && metrics.scoresGivenValues.length > 0) ? metrics.percentMaxScore.toFixed(1) + "%" : "N/A",
      (typeof metrics.percentMinScore === 'number' && metrics.scoresGivenValues.length > 0) ? metrics.percentMinScore.toFixed(1) + "%" : "N/A",
      (typeof metrics.percentMidScores === 'number' && metrics.scoresGivenValues.length > 0) ? metrics.percentMidScores.toFixed(1) + "%" : "N/A",
      (typeof metrics.avgIntraPeerSd === 'number') ? metrics.avgIntraPeerSd.toFixed(2) : "N/A",
      (typeof metrics.avgAbsDevFromGroupMedian === 'number') ? metrics.avgAbsDevFromGroupMedian.toFixed(2) : "N/A",
      metrics.commentsMadeCount || 0, 
      (typeof metrics.percentScoresWithComment === 'number') ? metrics.percentScoresWithComment.toFixed(1) + "%" : "N/A",
      (typeof metrics.avgCommentLength === 'number' && metrics.commentLengths && metrics.commentLengths.length > 0) ? metrics.avgCommentLength.toFixed(1) : "N/A",
      typeof metrics.calculatedWeight === 'number' ? metrics.calculatedWeight.toFixed(3) : "N/A"
    ]);
  }
  Logger.log(`Prepared ${outputDataRows.length} rows for the analytics report.`);

  // --- Write Data to Sheet ---
  if (outputDataRows.length > 0) { 
    reportSheet.getRange(2, 1, outputDataRows.length, analyticsHeaders.length).setValues(outputDataRows)
               .setVerticalAlignment("middle");
    const centerAlignHeaders = ["evaluatorId", "totalScoredAssessments", "distinctScoresUsed", "rangeOfScoresUsed", "totalComments"];
    centerAlignHeaders.forEach(header => {
        const colIdx = analyticsHeaders.indexOf(header);
        if (colIdx !== -1) {
            reportSheet.getRange(2, colIdx + 1, outputDataRows.length, 1).setHorizontalAlignment("center");
        }
    });
    const numericalHeaders = ["avgScoreGiven", "stdDevScoresGiven", "percentMaxScore", "percentMinScore", "percentMidScores", 
                              "avgIntraPeerSd", "avgAbsDevFromGroupMedian", "percentScoresWithComment", "avgCommentLength", "calculatedWeight"];
    numericalHeaders.forEach(header => {
        const colIdx = analyticsHeaders.indexOf(header);
        if (colIdx !== -1) {
            const columnData = reportSheet.getRange(2, colIdx + 1, outputDataRows.length, 1).getValues();
            const formats = columnData.map(row => [row[0] === "N/A" ? "@" : "0.00"]);
            reportSheet.getRange(2, colIdx + 1, outputDataRows.length, 1)
                       .setHorizontalAlignment("right")
                       .setNumberFormats(formats);
        }
    });
    reportSheet.autoResizeColumns(1, analyticsHeaders.length);
    Logger.log(`Evaluator analytics and weights generated in sheet "${analyticsSheetName}".`);
    // ✅ FIXED: Removed ui.alert() - web interface will show success message based on return value
    Logger.log(`SUCCESS: Analytics & Weights Generated - Evaluator analytics and weights written to sheet: "${analyticsSheetName}".`);
  } else {
    reportSheet.getRange(2,1).setValue("No evaluator metrics to display (outputDataRows was empty).");
    Logger.log("No evaluator metrics data to write for analytics sheet because outputDataRows was empty.");
    // ✅ FIXED: Removed ui.alert() - throw error instead for web interface to handle
    throw new Error("No evaluator metrics were generated to display.");
  }
  ss.setActiveSheet(reportSheet);
  Logger.log("--- Evaluator Analytics & Weight Generation Complete (Web-Safe) ---");
  return evaluatorWeights; 
}