# Peer Assessment Portal

A comprehensive web-based peer assessment system built with Google Apps Script and Google Sheets, designed for university courses to facilitate student peer evaluations.

## 🌟 Features

### Core Functionality
- **Secure Authentication**: Google account-based login with SHU email validation
- **Interactive Assessment Interface**: Clean, responsive web interface for conducting peer evaluations
- **Question Management**: 25 configurable assessment questions with rating scales and comment fields
- **Student Selection**: Dropdown interface with unit-based filtering and completion tracking
- **Real-time Progress**: Visual progress indicators and completion status tracking
- **Data Persistence**: Automatic saving to Google Sheets with reliable submission handling

### User Experience
- **Professional UI**: Modern, responsive design with intuitive navigation
- **Completion Tracking**: Visual checkmarks (✓) for completed assessments
- **Re-submission Support**: Users can revise assessments by re-evaluating students
- **Clear Messaging**: Honest user communications about system capabilities
- **Error Handling**: Robust error recovery with user-friendly feedback

### Administrative Features
- **Role-based Access**: Student and instructor modes with appropriate permissions
- **Unit Management**: Support for multiple production units (A, B, C, D)
- **Test Mode**: Development environment for testing and debugging
- **Analytics Ready**: Backend functions for generating reports and analytics

## 🏗️ Architecture

### Backend (Google Apps Script)
- **WebAPI.js**: Web application entry point and interface coordination
- **AuthHandler.js**: Authentication and user session management
- **SubmissionHandler.js**: Form submission processing and data validation
- **Workflow_*.js**: Analytics, scoring, and reporting functions
- **Config.js**: System configuration and constants
- **Utils.js**: Utility functions and validation helpers

### Frontend (HTML/CSS/JavaScript)
- **AssessmentInterface.html**: Main user interface with embedded JavaScript
- **Login.html**: Authentication interface
- **Direct API Integration**: Uses google.script.run for reliable backend communication

### Data Layer (Google Sheets)
- **PaRawSubmissionsV2**: Primary submission data storage
- **Question Configuration**: Configurable assessment questions
- **Student Directory**: User management and unit assignments

## 🚀 Getting Started

### Prerequisites
- Google Workspace account
- Google Apps Script access
- Node.js and npm (for development with clasp)

### Installation

1. **Clone the repository**
   ```bash
   git clone [your-repo-url]
   cd peer-assessment-system
   ```

2. **Install clasp (Google Apps Script CLI)**
   ```bash
   npm install -g @google/clasp
   clasp login
   ```

3. **Deploy to Google Apps Script**
   ```bash
   clasp create --type webapp --title "Peer Assessment Portal"
   clasp push
   ```

4. **Set up Google Sheets**
   - Create a new Google Sheets document
   - Configure the required sheets (see Data Schema section)
   - Update the spreadsheet ID in Config.js

5. **Deploy the web application**
   - In Google Apps Script: Deploy → New Deployment
   - Type: Web app
   - Execute as: Me
   - Access: Anyone with link (or your organization)

### Configuration

1. **Update Config.js** with your sheet names and settings
2. **Configure test users** in UserTestingScript.js
3. **Set up question definitions** in your Google Sheets
4. **Update email domain validation** in Utils.js if needed

## 📊 Data Schema

### PaRawSubmissionsV2 Sheet Headers
```
submissionId, responseId, timestamp, evaluatorId, evaluatorEmail, 
evaluatedStudentId, evaluatedStudentName, unitContextOfEvaluation, 
questionId, responseType, responseValue
```

### Submission ID Format
```
SUBM_{evaluatorId}_{evaluatedStudentId}_{YYYYMMDDHHMMSS}_{randomCode}
Example: SUBM_A113031034_A113031046_20250602141050_ABC
```

### Response Types
- **SCORE**: Numerical rating (1-5 scale)
- **COMMENT**: Text feedback and comments

## 🔧 Usage

### For Students
1. **Access the web application** using your SHU Google account
2. **Select a peer** from the dropdown menu
3. **Complete the assessment** using rating scales and comment fields
4. **Submit the assessment** with confirmation
5. **View completed assessments** with visual checkmarks
6. **Re-evaluate if needed** by selecting the same student again

### For Instructors
1. **Access instructor dashboard** with enhanced permissions
2. **View system statistics** and completion rates
3. **Run analytics functions** for generating reports
4. **Monitor assessment progress** across all students
5. **Generate reports** for grading and analysis

### For Administrators
1. **Configure questions** in the Google Sheets interface
2. **Manage user access** and unit assignments
3. **Monitor system health** using built-in diagnostics
4. **Export data** for external analysis

## 🛠️ Development

### Key Technologies
- **Google Apps Script**: Backend serverless platform
- **HTML5/CSS3/JavaScript**: Frontend web technologies
- **Google Sheets API**: Data storage and management
- **Google OAuth**: Authentication and authorization

### Development Workflow
1. **Local development** using clasp and your preferred editor
2. **Version control** with Git for code management
3. **Testing** using built-in test mode and development environment
4. **Deployment** via clasp push and Google Apps Script interface

### Testing
- **Test Mode**: Enable DEVELOPMENT_MODE for safe testing
- **Mock Data**: Use MockDataGenerator.js for sample data
- **User Testing**: UserTestingScript.js for simulating different users
- **Debug Functions**: Built-in debugging utilities and logging

## 🔒 Security & Privacy

- **Secure Authentication**: Google OAuth with institutional email validation
- **Data Privacy**: All data stored within your Google Workspace
- **Access Control**: Role-based permissions and unit-based filtering
- **Audit Trail**: Complete submission history with timestamps
- **Data Integrity**: Validation and error checking throughout the system

## 📈 Analytics & Reporting

The system includes built-in functions for:
- **Completion Analytics**: Track assessment completion rates
- **Scoring Calculations**: Automated weighted scoring algorithms
- **Progress Reports**: Generate detailed progress reports
- **Data Export**: CSV and spreadsheet-compatible formats

## ⚖️ Evaluator Weight System

The peer assessment system employs a sophisticated evaluator weighting mechanism to ensure fair and accurate final scores. Each evaluator's responses are assigned a weight that reflects their reliability and assessment quality.

### Weight Calculation Factors

#### 1. **Response Consistency (Primary Factor)**
- **Standard Deviation Analysis**: Evaluators with extremely low or high standard deviation in their ratings receive lower weights
- **Optimal Range**: Moderate standard deviation indicates thoughtful, discriminating evaluation
- **Mathematical Formula**:
  ```
  SD = √(Σ(xi - x̄)² / (n-1))
  
  Where:
  - xi = individual rating given by evaluator
  - x̄ = mean rating given by evaluator
  - n = number of students evaluated
  ```

- **Consistency Weight Factor**:
  ```
  If SD < 0.5:     Consistency_Factor = 0.6
  If 0.5 ≤ SD ≤ 2.0: Consistency_Factor = 1.0
  If SD > 2.0:     Consistency_Factor = 0.7
  ```

#### 2. **Central Tendency Bias**
- **Mean Score Analysis**: Evaluators who consistently rate all peers at extreme ends receive reduced weights
- **Mathematical Formula**:
  ```
  Mean_Rating = Σ(all_ratings) / number_of_ratings
  
  Bias_Factor = {
    0.7  if Mean_Rating ≤ 1.5 or Mean_Rating ≥ 4.5
    0.85 if 1.5 < Mean_Rating ≤ 2.0 or 4.0 ≤ Mean_Rating < 4.5
    1.0  if 2.0 < Mean_Rating < 4.0
  }
  ```

#### 3. **Assessment Completion Rate**
- **Mathematical Formula**:
  ```
  Completion_Rate = (Students_Evaluated / Total_Students_Assigned) × 100%
  
  Completion_Factor = {
    1.0  if Completion_Rate = 100%
    0.9  if 80% ≤ Completion_Rate < 100%
    0.7  if 60% ≤ Completion_Rate < 80%
    0.5  if 40% ≤ Completion_Rate < 60%
    0.3  if Completion_Rate < 40%
  }
  ```

#### 4. **Response Quality Factor**
- **Comment Length Analysis** (when comments are provided):
  ```
  Avg_Comment_Length = Total_Characters_in_Comments / Number_of_Comments
  
  Quality_Factor = {
    1.1  if Avg_Comment_Length ≥ 50 characters
    1.0  if 20 ≤ Avg_Comment_Length < 50 characters
    0.95 if 10 ≤ Avg_Comment_Length < 20 characters
    0.9  if Avg_Comment_Length < 10 characters
  }
  ```

### Complete Weight Calculation Algorithm

#### **Step 1: Calculate Individual Factors**
```
For each evaluator i:
  1. Calculate SD_i from all ratings given
  2. Calculate Mean_Rating_i from all ratings given
  3. Calculate Completion_Rate_i
  4. Calculate Avg_Comment_Length_i (if applicable)
  
  5. Determine factors:
     Consistency_Factor_i = f(SD_i)
     Bias_Factor_i = f(Mean_Rating_i)
     Completion_Factor_i = f(Completion_Rate_i)
     Quality_Factor_i = f(Avg_Comment_Length_i)
```

#### **Step 2: Calculate Raw Weight**
```
Raw_Weight_i = Base_Weight × Consistency_Factor_i × Bias_Factor_i × Completion_Factor_i × Quality_Factor_i

Where Base_Weight = 1.0 (baseline)
```

#### **Step 3: Normalize Weights Within Group**
```
For evaluation group with n evaluators:

Sum_of_Raw_Weights = Σ(Raw_Weight_i) for i = 1 to n

Normalized_Weight_i = (Raw_Weight_i / Sum_of_Raw_Weights) × n

This ensures: Σ(Normalized_Weight_i) = n (number of evaluators)
```

### Final Score Calculation Algorithm

#### **Step 1: Collect All Ratings for Each Student**
```
For student j being evaluated:
  Ratings_j = {r1j, r2j, r3j, ..., rnj}
  Weights_j = {w1, w2, w3, ..., wn}
  
Where:
- rij = rating given to student j by evaluator i
- wi = normalized weight of evaluator i
```

#### **Step 2: Calculate Weighted Average**
```
Weighted_Score_j = Σ(rij × wi) / Σ(wi) for all evaluators i who rated student j

Final_Score_j = Weighted_Score_j
```

#### **Step 3: Question-Level Scoring** (when applicable)
```
For each question q and student j:

Question_Score_jq = Σ(rijq × wi) / Σ(wi)

Where rijq = rating given to student j on question q by evaluator i
```

### Statistical Bounds and Validation

#### **Weight Boundaries**
```
Minimum_Weight = 0.1  (prevents complete exclusion)
Maximum_Weight = 2.0  (prevents excessive influence)

If Normalized_Weight_i < 0.1: Normalized_Weight_i = 0.1
If Normalized_Weight_i > 2.0: Normalized_Weight_i = 2.0

Re-normalize after applying bounds
```

#### **Data Validation Rules**
```
1. Minimum evaluators per student: 3
2. Minimum questions answered per evaluation: 80% of total questions
3. Rating scale validation: 1 ≤ rating ≤ 5
4. Missing data handling: Exclude from calculations, do not assume zero
```

### Example Calculation

#### **Sample Data for Evaluator A:**
```
Ratings given: [3, 4, 2, 4, 3, 5, 3]
Mean = 24/7 = 3.43
SD = √((0.43² + 0.57² + 1.43² + 0.57² + 0.43² + 1.57² + 0.43²)/6) = 0.90
Completion = 7/8 = 87.5%
Avg comment length = 35 characters
```

#### **Weight Calculation:**
```
Consistency_Factor = 1.0  (0.5 ≤ 0.90 ≤ 2.0)
Bias_Factor = 1.0        (2.0 < 3.43 < 4.0)
Completion_Factor = 0.9   (80% ≤ 87.5% < 100%)
Quality_Factor = 1.0      (20 ≤ 35 < 50)

Raw_Weight_A = 1.0 × 1.0 × 1.0 × 0.9 × 1.0 = 0.9
```

#### **If group has 8 evaluators with raw weights: [0.9, 1.1, 0.7, 1.0, 0.8, 1.2, 0.6, 1.0]**
```
Sum = 7.3
Normalized_Weight_A = (0.9 / 7.3) × 8 = 0.986
```

### Transparency Reports

The system generates detailed reports showing:
1. **Individual evaluator statistics** (for instructor review)
2. **Weight calculation breakdown** for each evaluator
3. **Final score composition** showing contribution of each evaluator
4. **Statistical summary** of evaluation patterns across the class

### Weight Application Process

#### 1. **Individual Weight Calculation**
```
Evaluator Weight = Base Weight × Consistency Factor × Completion Factor × Bias Adjustment
```

#### 2. **Normalization**
- All evaluator weights are normalized within each assessment group
- Ensures total weights sum to the number of evaluators for mathematical consistency

#### 3. **Final Score Calculation**
```
Final Score = Σ(Individual Rating × Evaluator Weight) / Σ(Evaluator Weights)
```

### Weight Categories

#### **High Weight Evaluators (0.8 - 1.2)**
- Consistent, thoughtful assessment patterns
- Appropriate use of rating scale
- Complete assessment submissions
- Reliable discrimination between peer performance levels

#### **Standard Weight Evaluators (0.6 - 0.8)**
- Generally reliable assessment patterns
- Minor inconsistencies or completion issues
- Adequate discrimination in ratings

#### **Low Weight Evaluators (0.3 - 0.6)**
- Significant consistency issues
- Extreme rating patterns (all high or all low scores)
- Incomplete assessments
- Limited discrimination between peers

#### **Minimal Weight Evaluators (0.1 - 0.3)**
- Highly unreliable assessment patterns
- Extreme central tendency or inconsistency
- Minimal assessment completion
- Reserved for cases where evaluation quality is severely compromised

### System Benefits

#### **For Students**
- **Fair Assessment**: Reduces impact of biased or unreliable peer evaluations
- **Quality Incentive**: Encourages thoughtful, careful assessment practices
- **Balanced Outcomes**: Prevents grade inflation or deflation from extreme evaluators

#### **For Instructors**
- **Reliable Data**: More accurate representation of actual peer performance
- **Quality Control**: Automatic identification of problematic evaluation patterns
- **Transparent Process**: Clear methodology for grade calculation and justification

#### **For Academic Integrity**
- **Bias Reduction**: Minimizes impact of personal relationships or conflicts
- **Statistical Validity**: Improves reliability and validity of peer assessment outcomes
- **Defensible Grading**: Provides objective, mathematical basis for final scores

### Implementation Notes

- **Automatic Calculation**: All weight calculations are performed automatically by the system
- **Transparent Reporting**: Weight factors can be included in analytical reports for instructor review
- **Continuous Adjustment**: Weights are recalculated with each new submission to reflect current assessment quality
- **Privacy Protection**: Individual evaluator weights are not visible to students, maintaining assessment integrity

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the built-in diagnostic functions
- Review the execution logs in Google Apps Script
- Consult the dependency tracker documentation
- Contact the development team

## 🎉 Acknowledgments

- Built with Google Apps Script platform
- Designed for educational institutions
- Developed with user experience and data integrity as primary goals

---

# 同儕評量系統

一個基於 Google Apps Script 和 Google Sheets 構建的綜合網頁同儕評量系統，專為大學課程設計，促進學生間的同儕評估。

## 🌟 功能特色

### 核心功能
- **安全認證**：基於 Google 帳戶登入，並驗證 SHU 電子郵件
- **互動評量介面**：簡潔、響應式的網頁界面進行同儕評估
- **題目管理**：25 個可配置的評估問題，包含評分量表和評論欄位
- **學生選擇**：下拉選單界面，支援單位篩選和完成狀態追蹤
- **即時進度**：視覺化進度指示器和完成狀態追蹤
- **資料持久化**：自動儲存至 Google Sheets，具備可靠的提交處理機制

### 使用者體驗
- **專業介面**：現代化、響應式設計，直觀導航
- **完成追蹤**：已完成評量的視覺化勾選標記 (✓)
- **重新提交支援**：使用者可透過重新評估學生來修訂評量
- **清晰訊息**：誠實的系統功能使用者溝通
- **錯誤處理**：強健的錯誤恢復機制，提供使用者友善的回饋

### 管理功能
- **角色權限**：學生和教師模式，具備適當權限
- **單位管理**：支援多個製作單位 (A、B、C、D)
- **測試模式**：測試和除錯的開發環境
- **分析就緒**：用於生成報告和分析的後端功能

## 🏗️ 系統架構

### 後端 (Google Apps Script)
- **WebAPI.js**：網頁應用程式入口點和介面協調
- **AuthHandler.js**：認證和使用者會話管理
- **SubmissionHandler.js**：表單提交處理和資料驗證
- **Workflow_*.js**：分析、評分和報告功能
- **Config.js**：系統配置和常數
- **Utils.js**：實用功能和驗證輔助工具

### 前端 (HTML/CSS/JavaScript)
- **AssessmentInterface.html**：主要使用者介面，內嵌 JavaScript
- **Login.html**：認證介面
- **直接 API 整合**：使用 google.script.run 進行可靠的後端通訊

### 資料層 (Google Sheets)
- **PaRawSubmissionsV2**：主要提交資料儲存
- **問題配置**：可配置的評估問題
- **學生目錄**：使用者管理和單位分配

## 🚀 開始使用

### 系統需求
- Google Workspace 帳戶
- Google Apps Script 存取權限
- Node.js 和 npm（使用 clasp 進行開發）

### 安裝步驟

1. **複製儲存庫**
   ```bash
   git clone [your-repo-url]
   cd peer-assessment-system
   ```

2. **安裝 clasp (Google Apps Script CLI)**
   ```bash
   npm install -g @google/clasp
   clasp login
   ```

3. **部署至 Google Apps Script**
   ```bash
   clasp create --type webapp --title "Peer Assessment Portal"
   clasp push
   ```

4. **設定 Google Sheets**
   - 建立新的 Google Sheets 文件
   - 配置必要的工作表（參考資料架構部分）
   - 在 Config.js 中更新試算表 ID

5. **部署網頁應用程式**
   - 在 Google Apps Script 中：部署 → 新增部署
   - 類型：網頁應用程式
   - 執行身分：我
   - 存取權限：知道連結的任何人（或您的組織）

### 配置設定

1. **更新 Config.js** 中的工作表名稱和設定
2. **在 UserTestingScript.js 中配置測試使用者**
3. **在 Google Sheets 中設定問題定義**
4. **如需要，在 Utils.js 中更新電子郵件網域驗證**

## 📊 資料架構

### PaRawSubmissionsV2 工作表標題
```
submissionId, responseId, timestamp, evaluatorId, evaluatorEmail, 
evaluatedStudentId, evaluatedStudentName, unitContextOfEvaluation, 
questionId, responseType, responseValue
```

### 提交 ID 格式
```
SUBM_{evaluatorId}_{evaluatedStudentId}_{YYYYMMDDHHMMSS}_{randomCode}
範例：SUBM_A113031034_A113031046_20250602141050_ABC
```

### 回應類型
- **SCORE**：數值評分（1-5 量表）
- **COMMENT**：文字回饋和評論

## 🔧 使用方法

### 學生使用
1. **使用 SHU Google 帳戶存取網頁應用程式**
2. **從下拉選單中選擇同學**
3. **使用評分量表和評論欄位完成評量**
4. **確認後提交評量**
5. **查看已完成的評量**，顯示視覺化勾選標記
6. **如需修改**，可重新選擇同一位學生進行評估

### 教師使用
1. **存取具有增強權限的教師儀表板**
2. **查看系統統計資料**和完成率
3. **執行分析功能**以生成報告
4. **監控所有學生的評量進度**
5. **生成評分和分析報告**

### 管理員使用
1. **在 Google Sheets 介面中配置問題**
2. **管理使用者存取**和單位分配
3. **使用內建診斷工具監控系統健康狀況**
4. **匯出資料**供外部分析使用

## 🛠️ 開發資訊

### 關鍵技術
- **Google Apps Script**：後端無伺服器平台
- **HTML5/CSS3/JavaScript**：前端網頁技術
- **Google Sheets API**：資料儲存和管理
- **Google OAuth**：認證和授權

### 開發工作流程
1. **本地開發**：使用 clasp 和您偏好的編輯器
2. **版本控制**：使用 Git 進行程式碼管理
3. **測試**：使用內建測試模式和開發環境
4. **部署**：透過 clasp push 和 Google Apps Script 介面

### 測試功能
- **測試模式**：啟用 DEVELOPMENT_MODE 進行安全測試
- **模擬資料**：使用 MockDataGenerator.js 產生範例資料
- **使用者測試**：UserTestingScript.js 模擬不同使用者
- **除錯功能**：內建除錯工具和日誌記錄

## 🔒 安全與隱私

- **安全認證**：Google OAuth 搭配機構電子郵件驗證
- **資料隱私**：所有資料儲存在您的 Google Workspace 內
- **存取控制**：基於角色的權限和單位篩選
- **稽核軌跡**：完整的提交歷史記錄，包含時間戳記
- **資料完整性**：全系統的驗證和錯誤檢查

## 📈 分析與報告

系統包含內建功能：
- **完成分析**：追蹤評量完成率
- **評分計算**：自動化加權評分演算法
- **進度報告**：生成詳細進度報告
- **資料匯出**：CSV 和試算表相容格式

## ⚖️ 評量者權重系統

同儕評量系統採用精密的評量者權重機制，確保公平且準確的最終分數。每位評量者的回應都會被分配一個反映其可靠性和評量品質的權重。

### 權重計算因子

#### 1. **回應一致性（主要因子）**
- **標準差分析**：評分標準差極低或極高的評量者獲得較低權重
- **最佳範圍**：適中的標準差表示深思熟慮、有辨別力的評量
- **數學公式**：
  ```
  SD = √(Σ(xi - x̄)² / (n-1))
  
  其中：
  - xi = 評量者給出的個別評分
  - x̄ = 評量者給出的平均評分
  - n = 被評量的學生人數
  ```

- **一致性權重因子**：
  ```
  如果 SD < 0.5：     一致性因子 = 0.6
  如果 0.5 ≤ SD ≤ 2.0： 一致性因子 = 1.0
  如果 SD > 2.0：     一致性因子 = 0.7
  ```

#### 2. **中央趨勢偏誤**
- **平均分數分析**：持續將所有同儕評為極端分數的評量者獲得較低權重
- **數學公式**：
  ```
  平均評分 = Σ(所有評分) / 評分總數
  
  偏誤因子 = {
    0.7  如果 平均評分 ≤ 1.5 或 平均評分 ≥ 4.5
    0.85 如果 1.5 < 平均評分 ≤ 2.0 或 4.0 ≤ 平均評分 < 4.5
    1.0  如果 2.0 < 平均評分 < 4.0
  }
  ```

#### 3. **評量完成率**
- **數學公式**：
  ```
  完成率 = (已評量學生數 / 指定評量學生總數) × 100%
  
  完成因子 = {
    1.0  如果 完成率 = 100%
    0.9  如果 80% ≤ 完成率 < 100%
    0.7  如果 60% ≤ 完成率 < 80%
    0.5  如果 40% ≤ 完成率 < 60%
    0.3  如果 完成率 < 40%
  }
  ```

#### 4. **回應品質因子**
- **評論長度分析**（當提供評論時）：
  ```
  平均評論長度 = 評論總字符數 / 評論數量
  
  品質因子 = {
    1.1  如果 平均評論長度 ≥ 50 字符
    1.0  如果 20 ≤ 平均評論長度 < 50 字符
    0.95 如果 10 ≤ 平均評論長度 < 20 字符
    0.9  如果 平均評論長度 < 10 字符
  }
  ```

### 完整權重計算演算法

#### **步驟 1：計算個別因子**
```
對於每位評量者 i：
  1. 從所有給出的評分計算 SD_i
  2. 從所有給出的評分計算 平均評分_i
  3. 計算 完成率_i
  4. 計算 平均評論長度_i（如適用）
  
  5. 確定因子：
     一致性因子_i = f(SD_i)
     偏誤因子_i = f(平均評分_i)
     完成因子_i = f(完成率_i)
     品質因子_i = f(平均評論長度_i)
```

#### **步驟 2：計算原始權重**
```
原始權重_i = 基礎權重 × 一致性因子_i × 偏誤因子_i × 完成因子_i × 品質因子_i

其中 基礎權重 = 1.0（基準線）
```

#### **步驟 3：群組內權重正規化**
```
對於有 n 位評量者的評量群組：

原始權重總和 = Σ(原始權重_i) 對 i = 1 到 n

正規化權重_i = (原始權重_i / 原始權重總和) × n

這確保：Σ(正規化權重_i) = n（評量者人數）
```

### 最終分數計算演算法

#### **步驟 1：收集每位學生的所有評分**
```
對於被評量的學生 j：
  評分_j = {r1j, r2j, r3j, ..., rnj}
  權重_j = {w1, w2, w3, ..., wn}
  
其中：
- rij = 評量者 i 給學生 j 的評分
- wi = 評量者 i 的正規化權重
```

#### **步驟 2：計算加權平均**
```
加權分數_j = Σ(rij × wi) / Σ(wi) 對所有評量學生 j 的評量者 i

最終分數_j = 加權分數_j
```

#### **步驟 3：題目層級評分**（如適用）
```
對於每個題目 q 和學生 j：

題目分數_jq = Σ(rijq × wi) / Σ(wi)

其中 rijq = 評量者 i 給學生 j 在題目 q 上的評分
```

### 統計界限與驗證

#### **權重邊界**
```
最小權重 = 0.1（防止完全排除）
最大權重 = 2.0（防止過度影響）

如果 正規化權重_i < 0.1：正規化權重_i = 0.1
如果 正規化權重_i > 2.0：正規化權重_i = 2.0

應用邊界後重新正規化
```

#### **資料驗證規則**
```
1. 每位學生最少評量者數：3
2. 每次評量最少回答題目數：總題目數的 80%
3. 評分量表驗證：1 ≤ 評分 ≤ 5
4. 遺漏資料處理：從計算中排除，不假設為零
```

### 計算範例

#### **評量者 A 的範例資料：**
```
給出的評分：[3, 4, 2, 4, 3, 5, 3]
平均 = 24/7 = 3.43
SD = √((0.43² + 0.57² + 1.43² + 0.57² + 0.43² + 1.57² + 0.43²)/6) = 0.90
完成率 = 7/8 = 87.5%
平均評論長度 = 35 字符
```

#### **權重計算：**
```
一致性因子 = 1.0（0.5 ≤ 0.90 ≤ 2.0）
偏誤因子 = 1.0（2.0 < 3.43 < 4.0）
完成因子 = 0.9（80% ≤ 87.5% < 100%）
品質因子 = 1.0（20 ≤ 35 < 50）

原始權重_A = 1.0 × 1.0 × 1.0 × 0.9 × 1.0 = 0.9
```

#### **如果群組有 8 位評量者，原始權重為：[0.9, 1.1, 0.7, 1.0, 0.8, 1.2, 0.6, 1.0]**
```
總和 = 7.3
正規化權重_A = (0.9 / 7.3) × 8 = 0.986
```

### 透明度報告

系統產生詳細報告，顯示：
1. **個別評量者統計**（供教師檢視）
2. **每位評量者的權重計算分解**
3. **最終分數組成**，顯示每位評量者的貢獻
4. **全班評量模式的統計摘要**

### 權重應用流程

#### 1. **個別權重計算**
```
評量者權重 = 基礎權重 × 一致性因子 × 完成因子 × 偏誤調整
```

#### 2. **正規化**
- 所有評量者權重在各評量群組內進行正規化
- 確保總權重和等於評量者人數，維持數學一致性

#### 3. **最終分數計算**
```
最終分數 = Σ(個別評分 × 評量者權重) / Σ(評量者權重)
```

### 權重分類

#### **高權重評量者（0.8 - 1.2）**
- 一致、深思熟慮的評量模式
- 適當使用評分量表
- 完整提交評量
- 可靠的同儕表現水準辨別能力

#### **標準權重評量者（0.6 - 0.8）**
- 大致可靠的評量模式
- 輕微的不一致或完成問題
- 評分辨別能力適當

#### **低權重評量者（0.3 - 0.6）**
- 顯著的一致性問題
- 極端評分模式（全高分或全低分）
- 評量不完整
- 同儕間辨別能力有限

#### **最低權重評量者（0.1 - 0.3）**
- 高度不可靠的評量模式
- 極端中央趨勢或不一致性
- 評量完成度極低
- 保留給評量品質嚴重受損的情況

### 系統效益

#### **對學生**
- **公平評量**：減少偏頗或不可靠同儕評量的影響
- **品質激勵**：鼓勵深思熟慮、仔細的評量實踐
- **平衡結果**：防止極端評量者造成的分數膨脹或緊縮

#### **對教師**
- **可靠數據**：更準確反映實際同儕表現
- **品質控制**：自動識別問題評量模式
- **透明流程**：成績計算和論證的清晰方法論

#### **對學術誠信**
- **偏誤減少**：最小化個人關係或衝突的影響
- **統計有效性**：提高同儕評量結果的可靠性和有效性
- **可辯護評分**：為最終分數提供客觀、數學基礎

### 實施說明

- **自動計算**：所有權重計算由系統自動執行
- **透明報告**：權重因子可包含在分析報告中供教師檢視
- **持續調整**：每次新提交後重新計算權重，反映當前評量品質
- **隱私保護**：個別評量者權重對學生不可見，維護評量完整性

## 🤝 貢獻

1. Fork 此儲存庫
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的變更 (`git commit -m 'Add amazing feature'`)
4. 推送至分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📝 授權

此專案採用 MIT 授權 - 詳見 LICENSE 檔案。

## 🆘 支援

如需支援和問題諮詢：
- 檢查內建診斷功能
- 查看 Google Apps Script 中的執行日誌
- 參考相依性追蹤器文件
- 聯繫開發團隊

## 🎉 致謝

- 基於 Google Apps Script 平台構建
- 專為教育機構設計
- 以使用者體驗和資料完整性為主要開發目標