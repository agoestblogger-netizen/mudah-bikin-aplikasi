export type PRDStage =
  | 'TAHAP_1_PEMBUKAAN'
  | 'TAHAP_2_MOCKUP'
  | 'TAHAP_3_KUNCI_KEBUTUHAN'
  | 'TAHAP_4_BACKEND'
  | 'TAHAP_5_PATCH'
  | 'TAHAP_6_TROUBLESHOOTING';

export interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  text: string;
  timestamp: string;
  suggestedOptions?: string[];
}

export interface MandatorySpecs {
  requiresLogin: boolean;
  loginType: 'NONE' | 'BASIC_AUTH' | 'ROLE_BASED';
  hasAdminRole: boolean;
  hasUserManagement: boolean;
  keyButtonsActions: string[];
  basicValidationRules: string[];
  targetUsers: string;
  appGoal: string;
  appType: string;
}

export interface FeatureChecklistItem {
  id: string;
  category: 'Auth & Access' | 'Core Workflow' | 'UI & Canvas' | 'Backend & Data';
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface RolePermission {
  roleName: 'Admin' | 'User' | 'Guest';
  canAddUser: boolean;
  canEditData: boolean;
  canViewReports: boolean;
  accessScope: string;
}

export interface DataColumn {
  columnName: string;
  dataType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'JSON';
  isRequired: boolean;
  description: string;
}

export interface FeaturePatchRequest {
  id: string;
  requestedAt: string;
  description: string;
  targetComponent: string;
  status: 'APPLIED' | 'PENDING';
  patchSummary: string;
}

export interface TroubleshootIssue {
  id: string;
  category: 'CORS_GAS' | 'ADMIN_AUTH' | 'FORM_VALIDATION' | 'STATE_JS' | 'DEPLOYMENT';
  title: string;
  symptom: string;
  rootCause: string;
  solutionSteps: string[];
  status: 'RESOLVED' | 'UNRESOLVED';
}

export interface QualityAuditResult {
  isCanvasCodeOnly: boolean;
  hasDynamicState: boolean;
  hasAdminUserManagement: boolean;
  hasLoginValidation: boolean;
  isResponsiveGlassmorphism: boolean;
  hasGasBackend: boolean;
  totalScore: number;
  warnings: string[];
  recommendations: string[];
}

export interface AppProjectState {
  id: string;
  title: string;
  description: string;
  currentStage: PRDStage;
  chatMessages: ChatMessage[];
  mandatorySpecs: MandatorySpecs;
  featureChecklist: FeatureChecklistItem[];
  rolePermissions: RolePermission[];
  dataColumns: DataColumn[];
  canvasCode: {
    html: string;
    css: string;
    js: string;
  };
  gasConfig: {
    sheetId: string;
    webAppUrl: string;
    scriptCode: string;
    isConnected: boolean;
  };
  patchHistory: FeaturePatchRequest[];
  troubleshootIssues: TroubleshootIssue[];
  qualityAudit: QualityAuditResult;
  updatedAt: string;
}
