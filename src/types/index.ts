export type RequirementStatus = "matched" | "not_matched" | "needs_verification" | "document_missing";

export type RequirementOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "one_of"
  | "exists";

export type Requirement = {
  id: string;
  label: string;
  field: string;
  operator: RequirementOperator;
  expectedValue?: string | number | string[];
  requiredDocumentId?: string;
  failureAction?: string;
};

export type Scholarship = {
  id: string;
  title: string;
  provider: string;
  amount: number;
  deadline: string;
  studyLevel: "undergraduate" | "postgraduate" | "all";
  category: "merit" | "need_based" | "diversity" | "stem";
  description: string;
  requirements: Requirement[];
  sourceUrl: string;
};

export type StudentProfile = {
  name: string;
  email: string;
  level: "undergraduate" | "postgraduate";
  gpa?: number;
  familyIncome?: number;
  category: string;
  state: string;
};

export type DocumentRecord = {
  id: string;
  category: string;
  label: string;
  status: "missing" | "uploaded" | "verified";
  updatedAt: string;
};

export type RequirementResult = {
  requirementId: string;
  label: string;
  status: RequirementStatus;
  explanation: string;
  nextAction?: string;
};

export type EligibilityAssessment = {
  scholarshipId: string;
  results: RequirementResult[];
  blockers: RequirementResult[];
  canApply: boolean;
  readinessScore: number;
};

export type ApplicationStage = "saved" | "preparing" | "ready" | "applied" | "under_review" | "completed";

export type ChecklistItem = {
  id: string;
  task: string;
  completed: boolean;
};

export type Application = {
  scholarshipId: string;
  stage: ApplicationStage;
  checklist: ChecklistItem[];
  deadline: string;
};

export type ActionItem = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  scholarshipId?: string;
  actionType: "verify_profile" | "upload_document" | "review_deadline";
};

export type AppState = {
  profile: StudentProfile;
  documents: DocumentRecord[];
  applications: Application[];
  savedScholarshipIds: string[];
};
