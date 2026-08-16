export type AppPhase = 'FASE_0_WELCOME' | 'FASE_1_INTERVIEW' | 'FASE_2_CANVAS' | 'FASE_3_BRIEF' | 'FASE_4_GAS_BACKEND' | 'FASE_5_DEPLOY';

export type InputMode = 'TEXT' | 'IMAGE_VISUAL_DNA';

export type ImageSubCase = 'SKETCH_UI' | 'SCREENSHOT_REF' | 'COLOR_PALETTE' | 'ARCH_DIAGRAM';

export interface VisualDNA {
  themeName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  accentColor: string;
  borderRadius: string;
  fontStyle: string;
  visualMood: 'Glassmorphism' | 'Minimalist Modern' | 'Vibrant Tech' | 'Dark Futuristic' | 'Corporate Elegant';
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
  currentPhase: AppPhase;
  inputMode: InputMode;
  imageSubCase?: ImageSubCase;
  visualDNA: VisualDNA;
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
  qualityAudit: QualityAuditResult;
  updatedAt: string;
}
