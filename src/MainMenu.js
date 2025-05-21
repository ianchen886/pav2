// In MainMenu.gs

/**
 * @OnlyCurrentDoc
 * This special function runs when the spreadsheet is opened.
 * It adds a custom menu to the Google Sheets UI with a logical workflow order.
 */
// eslint-disable-next-line no-unused-vars
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // Create the main menu and assign it to a variable
  var mainMenu = ui.createMenu('Peer Review Workflow'); 

  // Add items to the main menu
  mainMenu.addItem('1. Generate Evaluator Analytics & Weights', 'generateEvaluatorAnalyticsAndWeights'); 
  mainMenu.addItem('2. Calculate WEIGHTED Peer Scores (to PaFinalScoresSummary)', 'calculateWeightedScoresAndUpdateSheet'); 
  mainMenu.addItem('3. Generate Raw Scores Report (with Weights)', 'generateRawScoresReportWithWeights');
  mainMenu.addSeparator();
  mainMenu.addItem('4. Generate Detailed Missing Assessments Report', 'findStudentsWhoHaventAssessedSpecificPeers'); 
  mainMenu.addItem('5. Verify Missing Assessments Report', 'verifyMissingAssessmentsReport'); // Removed extra separator here, add one before submenu
  
  // --- Create the submenu for Utilities ---
  var utilMenu = ui.createMenu('Sheet Utilities'); // This creates a menu object that can be used as a submenu
  utilMenu.addItem('Clear ALL Output Sheets (Content Only)', 'clearALLOutputSheets');
  utilMenu.addSeparator();
  utilMenu.addItem('Clear Evaluator Analytics Sheet', 'clearEvaluatorAnalyticsSheet');
  utilMenu.addItem('Clear Final Scores Summary Sheet', 'clearFinalScoresSummarySheet');
  utilMenu.addItem('Clear All Responses Report Sheet', 'clearReportAllResponsesSheet');
  utilMenu.addItem('Clear Missing Assessments Report Sheet', 'clearMissingAssessmentsReportSheet');
  utilMenu.addItem('Clear Verification Summary Sheet', 'clearVerificationMissingAssessmentsSheet');
  
  // Add the utility submenu to the main menu
  mainMenu.addSeparator(); // Add a separator before the submenu
  mainMenu.addSubMenu(utilMenu); 
  
  // Add the entire composed main menu (with its submenu) to the UI ONCE
  mainMenu.addToUi(); 
}