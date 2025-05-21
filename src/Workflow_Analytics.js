// In Workflow_Analytics.gs

/**
 * Generates evaluator analytics and calculates weights.
 * - Uses camelCase headers for its output sheet.
 * - Creates/clears the output sheet and populates headers.
 * - Returns the calculated evaluatorWeights object.
 */
function generateEvaluatorAnalyticsAndWeights() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.clear();
  Logger.log("--- Starting Evaluator Analytics & Weight Generation (camelCase Headers) ---");

  const analyticsSheetName = PA_EVALUATOR_ANALYTICS_SHEET_NAME; 

  const parsedData = parseRawSurveyData(); 
  if (!parsedData || !parsedData.students || !parsedData.responses || !parsedData.questions ) {
    ui.alert("Data Parsing Error", "Could not parse necessary data. Cannot generate analytics.", ui.ButtonSet.OK);
    Logger.log("ERROR: parseRawSurveyData did not return expected data for analytics.");
    return null; 
  }
  const { students: allStudents, questions, responses } = parsedData; 

  Logger.log(`Analytics - Parsed Students Count: ${Object.keys(allStudents).length}`);
  Logger.log(`Analytics - Parsed Questions Count: ${Object.keys(questions).length}`);
  Logger.log(`Analytics - Parsed Responses Count: ${responses.length}`);

  if (Object.keys(allStudents).length === 0 ) {
      ui.alert("No Data", "No student data found for analytics.", ui.ButtonSet.OK);
      return null; 
  }

  var reportSheet = ss.getSheetByName(analyticsSheetName);
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
    if (allStudents.hasOwnProperty(studentId) && allStudents[studentId] && 
        !studentId.startsWith("UNKNOWNID_") && /^[A-Z]{1}[0-9]{9}$/.test(studentId)) {
      evaluatorMetrics[studentId] = {
        studentId: studentId,
        studentName: allStudents[studentId].studentName || `[Name missing for ${studentId}]`, 
        scoresGivenValues: [], commentsMadeCount: 0, assessmentsWhereCommentProvided: 0, 
        totalScoredAssessments: 0, commentLengths: [],
        distinctScoreValuesUsed: new Set(), absDeviationsFromGroupMedianArray: [] // Changed name for clarity
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
    const evalKey = `${evaluatorId}_${response.evaluatedStudentId}_${response.responseToQuestionId}`;

    if (response.responseType === "SCORE" && typeof response.responseValue === 'number' && !isNaN(response.responseValue)) {
      evaluatorMetrics[evaluatorId].scoresGivenValues.push(response.responseValue);
      evaluatorMetrics[evaluatorId].totalScoredAssessments++;
      evaluatorMetrics[evaluatorId].distinctScoreValuesUsed.add(response.responseValue);
      if (!scoreCommentPairTracker[evalKey]) scoreCommentPairTracker[evalKey] = { hasScore: false, hasComment: false };
      scoreCommentPairTracker[evalKey].hasScore = true;
    } else if (response.responseType === "COMMENT" && response.responseValue && response.responseValue.toString().trim() !== "") {
      evaluatorMetrics[evaluatorId].commentsMadeCount++;
      evaluatorMetrics[evaluatorId].commentLengths.push(response.responseValue.toString().trim().length);
      if (!scoreCommentPairTracker[evalKey]) scoreCommentPairTracker[evalKey] = { hasScore: false, hasComment: false };
      scoreCommentPairTracker[evalKey].hasComment = true;
    }
  });

  for (const key in scoreCommentPairTracker) {
      const parts = key.split('_');
      const evaluatorId = parts[0];
      if (!evaluatorMetrics[evaluatorId]) continue; 
      const pair = scoreCommentPairTracker[key];
      if (pair.hasScore && pair.hasComment) { 
          evaluatorMetrics[evaluatorId].assessmentsWhereCommentProvided++;
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
              if (r2.responseByStudentId && 
                  r2.responseType === "SCORE" && typeof r2.responseValue === 'number' && 
                  r1.evaluatedStudentId === r2.evaluatedStudentId &&
                  r1.responseToQuestionId === r2.responseToQuestionId &&
                  r1.responseByStudentId !== r2.responseByStudentId) { 
                  scoresByItemFromOthers[itemKey].push(r2.responseValue);
              }
          });
          // Remove duplicates from scores by others for the same item (unlikely but good practice)
          if (scoresByItemFromOthers[itemKey].length > 0) {
            scoresByItemFromOthers[itemKey] = [...new Set(scoresByItemFromOthers[itemKey])];
          }
      }
  });
  let groupMediansByItem = {}; 
  for(const itemKey in scoresByItemFromOthers){
      if (scoresByItemFromOthers[itemKey].length > 0) {
        groupMediansByItem[itemKey] = calculateMedianFromArray(scoresByItemFromOthers[itemKey]); 
      }
  }
  Logger.log("Analytics: Group medians for deviation metric calculated.");
  
  // --- Calculate advanced metrics for each evaluator ---
  for (const evaluatorId in evaluatorMetrics) {
    const metrics = evaluatorMetrics[evaluatorId];
    
    if (metrics.scoresGivenValues.length > 0) {
        metrics.avgScoreGiven = calculateMean(metrics.scoresGivenValues);
        metrics.stdDevScoresGiven = metrics.scoresGivenValues.length >= 2 ? calculateStdDev(metrics.scoresGivenValues, metrics.avgScoreGiven) : 0;
        const minVal = Math.min(...metrics.scoresGivenValues);
        const maxVal = Math.max(...metrics.scoresGivenValues);
        metrics.rangeScoresUsed = maxVal - minVal;
        metrics.percentMaxScore = (metrics.scoresGivenValues.filter(s => s === 4).length / metrics.scoresGivenValues.length) * 100;
        metrics.percentMinScore = (metrics.scoresGivenValues.filter(s => s === 1).length / metrics.scoresGivenValues.length) * 100;
        metrics.percentMidScores = (metrics.scoresGivenValues.filter(s => s === 2 || s === 3).length / metrics.scoresGivenValues.length) * 100;
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
        if (perPeerScoresGiven[peerId].length >= 2) { 
            intraPeerStdDevsAccumulator.push(calculateStdDev(perPeerScoresGiven[peerId]));
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
    metrics.absDeviationsFromGroupMedianArray = absDeviationsTempArray; 
    metrics.avgAbsDevFromGroupMedian = metrics.absDeviationsFromGroupMedianArray.length > 0 ? calculateMean(metrics.absDeviationsFromGroupMedianArray) : 0;
     
    metrics.percentScoresWithComment = metrics.totalScoredAssessments > 0 ? (metrics.assessmentsWhereCommentProvided / metrics.totalScoredAssessments) * 100 : 0;
    metrics.avgCommentLength = metrics.commentLengths.length > 0 ? calculateMean(metrics.commentLengths) : 0;
  }
  Logger.log(`Analytics: Advanced metrics calculated for all evaluators.`);

  // --- Calculate Evaluator Weights ---
  let evaluatorWeights = {}; 
  Logger.log("Analytics: Calculating evaluator weights...");
  for (const evaluatorId in evaluatorMetrics) {
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
        if (metrics.distinctScoreValuesUsed.size >= 3 && metrics.stdDevScoresGiven < 0.50) weight -= 0.10; 
        if (metrics.avgIntraPeerSd < 0.25 && metrics.totalScoredAssessments >= 10) weight -= 0.15;
        if (metrics.avgAbsDevFromGroupMedian > 0.70 && numScoresGiven >= 10) weight -= 0.15;
        if (metrics.percentScoresWithComment > 30) weight += 0.05;
        if (metrics.percentScoresWithComment > 50) weight += 0.05; 
    }

    weight = Math.max(0.0, weight); 
    if (numScoresGiven > 0 && weight < 0.4 && weight !== 0.0) weight = 0.4; 
    weight = Math.min(1.0, weight); 

    metrics.calculatedWeight = parseFloat(weight.toFixed(3)); 
    evaluatorWeights[evaluatorId] = metrics.calculatedWeight; 
  }
  Logger.log("Analytics: Evaluator weights calculated.");

  // --- Prepare Data Rows for Output Sheet ---
  let outputDataRows = [];
  const evaluatorIdsFromMetrics = Object.keys(evaluatorMetrics);
  Logger.log(`DEBUG SORT: About to sort ${evaluatorIdsFromMetrics.length} evaluator IDs. Sample IDs: ${evaluatorIdsFromMetrics.slice(0,5).join(', ')}`);

  const sortedEvaluatorIdsForReport = evaluatorIdsFromMetrics.sort((a, b) => {
      const metricA = evaluatorMetrics[a];
      const metricB = evaluatorMetrics[b];
      let aName = "[SORT_DEBUG_ANAME_UNSET]"; 
      let bName = "[SORT_DEBUG_BNAME_UNSET]"; 
      if (metricA && metricA.studentName && typeof metricA.studentName === 'string') { aName = metricA.studentName; } 
      else if (a && typeof a === 'string') { aName = a; Logger.log(`DEBUG SORT: Fallback to ID for a. Original a: '${a}', metricA studentName: ${metricA ? metricA.studentName : 'metricA undefined'}`);} 
      else { aName = ""; Logger.log(`DEBUG SORT: Critical fallback to empty string for a. Original a: '${a}', metricA: ${metricA ? JSON.stringify(metricA) : 'metricA undefined'}`); }
      if (metricB && metricB.studentName && typeof metricB.studentName === 'string') { bName = metricB.studentName; } 
      else if (b && typeof b === 'string') { bName = b; Logger.log(`DEBUG SORT: Fallback to ID for b. Original b: '${b}', metricB studentName: ${metricB ? metricB.studentName : 'metricB undefined'}`);} 
      else { bName = ""; Logger.log(`DEBUG SORT: Critical fallback to empty string for b. Original b: '${b}', metricB: ${metricB ? JSON.stringify(metricB) : 'metricB undefined'}`); }
      if (typeof aName !== 'string' || typeof bName !== 'string') { Logger.log(`DEBUG SORT ERROR: Non-string! a: '${aName}', b: '${bName}'. Defaulting to ID sort.`); return (a || "").toString().localeCompare((b || "").toString()); }
      return aName.localeCompare(bName);
  });

  for (const evaluatorId of sortedEvaluatorIdsForReport) {
    const metrics = evaluatorMetrics[evaluatorId];
    outputDataRows.push([
      evaluatorId, 
      metrics.studentName || `[Name for ${evaluatorId}]`,
      metrics.totalScoredAssessments || 0, 
      (metrics.avgScoreGiven !== undefined && !isNaN(metrics.avgScoreGiven) && metrics.scoresGivenValues.length > 0) ? metrics.avgScoreGiven.toFixed(2) : "N/A",
      (metrics.stdDevScoresGiven !== undefined && !isNaN(metrics.stdDevScoresGiven) && metrics.scoresGivenValues.length > 1) ? metrics.stdDevScoresGiven.toFixed(2) : "N/A",
      metrics.distinctScoreValuesUsed ? metrics.distinctScoreValuesUsed.size : 0,
      (metrics.rangeScoresUsed !== undefined && metrics.scoresGivenValues.length > 0) ? metrics.rangeScoresUsed : "N/A",
      (metrics.percentMaxScore !== undefined && !isNaN(metrics.percentMaxScore) && metrics.scoresGivenValues.length > 0) ? metrics.percentMaxScore.toFixed(1) + "%" : "N/A",
      (metrics.percentMinScore !== undefined && !isNaN(metrics.percentMinScore) && metrics.scoresGivenValues.length > 0) ? metrics.percentMinScore.toFixed(1) + "%" : "N/A",
      (metrics.percentMidScores !== undefined && !isNaN(metrics.percentMidScores) && metrics.scoresGivenValues.length > 0) ? metrics.percentMidScores.toFixed(1) + "%" : "N/A",
      (metrics.avgIntraPeerSd !== undefined && !isNaN(metrics.avgIntraPeerSd)) ? metrics.avgIntraPeerSd.toFixed(2) : "N/A", // Allow 0 for this
      (metrics.avgAbsDevFromGroupMedian !== undefined && !isNaN(metrics.avgAbsDevFromGroupMedian)) ? metrics.avgAbsDevFromGroupMedian.toFixed(2) : "N/A", // Allow 0
      metrics.commentsMadeCount || 0, 
      (metrics.percentScoresWithComment !== undefined && !isNaN(metrics.percentScoresWithComment)) ? metrics.percentScoresWithComment.toFixed(1) + "%" : "N/A",
      (metrics.avgCommentLength !== undefined && !isNaN(metrics.avgCommentLength) && metrics.commentLengths && metrics.commentLengths.length > 0) ? metrics.avgCommentLength.toFixed(1) : "N/A",
      metrics.calculatedWeight !== undefined ? metrics.calculatedWeight.toFixed(3) : "N/A"
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
            reportSheet.getRange(2, colIdx + 1, outputDataRows.length, 1).setHorizontalAlignment("right");
        }
    });
    reportSheet.autoResizeColumns(1, analyticsHeaders.length);
    Logger.log(`Evaluator analytics and weights generated in sheet "${analyticsSheetName}".`);
    ui.alert("Analytics & Weights Generated", `Evaluator analytics and weights written to sheet: "${analyticsSheetName}".`, ui.ButtonSet.OK);
  } else {
    reportSheet.getRange(2,1).setValue("No evaluator metrics to display (outputDataRows was empty).");
    Logger.log("No evaluator metrics data to write for analytics sheet because outputDataRows was empty.");
    ui.alert("Info", "No evaluator metrics were generated to display.", ui.ButtonSet.OK);
  }
  ss.setActiveSheet(reportSheet);
  Logger.log("--- Evaluator Analytics & Weight Generation Complete ---");
  return evaluatorWeights; 
}