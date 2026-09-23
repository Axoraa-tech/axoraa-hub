export type WorkStatus = "Completed" | "In Progress" | "Blocked";
export type PriorityLevel = "Critical" | "High" | "Medium" | "Low";
export type BlockedFlag = "Yes" | "No";
export type ReviewRequiredFlag = "Yes" | "No";
export type DeploymentEnv = "Development" | "Staging" | "Production" | "Not Applicable";
export type ProductionImpactLevel = "High" | "Medium" | "Low" | "None";

export type DeveloperName =
  | "Akshar"
  | "Abhinav"
  | "Adnaan"
  | "Bhuvan"
  | "Manish"
  | "Vinod"
  | "Chakravarthi"
  | "Intern";

export type ProjectName = "SeekFactory" | "Seek factory APK" | "Marketing Operations" | "Client Accounts";

export type RepositoryName =
  | "seekfactory-b"
  | "seekfactory-web-f"
  | "seekfactory-app-f";

export type WorkType =
  | "Authentication / Authorization"
  | "Refactoring"
  | "Database"
  | "Bug Fix / UI Enhancement"
  | "DevOps / Infrastructure"
  | "UI/UX Improvement"
  | "API Integration"
  | "New Feature"
  | "Feature Enhancement";

export interface DailyWorkLogEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  developerName: DeveloperName | string;
  project: ProjectName | string;
  repository: RepositoryName | string;
  module: string;
  workType: WorkType | string;
  taskDescription: string;
  githubPr: string;
  workStatus: WorkStatus;
  priority: PriorityLevel;
  hours: number;
  isBlocked: BlockedFlag;
  blockerDetails: string;
  reviewRequired: ReviewRequiredFlag;
  reviewer: string;
  deployment: DeploymentEnv;
  productionImpact: ProductionImpactLevel;
  notes: string;
  lastUpdated: string;
}

export interface DeveloperRosterMember {
  id: string;
  developerName: string;
  role: string;
  primaryArea: string;
  active: "Yes" | "No";
  joiningDate: string;
  notes: string;
  avatar?: string;
}

export interface RepositoryMapping {
  id: string;
  projectName: string;
  repository: string;
  type: string;
  status: "Active" | "Archived" | "Maintenance";
  description: string;
}

export interface EscalationLevel {
  level: string;
  trigger: string;
  action: string;
  badgeColor: string;
}

export interface GoldenRule {
  category: string;
  do: string;
  dont: string;
}

export interface SOPGuideData {
  workbookMap: { tab: string; purpose: string; audience: string; frequency: string }[];
  dailySteps: string[];
  escalationLevels: EscalationLevel[];
  goldenRules: GoldenRule[];
}

export type UserRoleCategory = "founder" | "admin" | "developer" | "marketing";

export interface UserProfile {
  id: string;
  name: string;
  roleTitle: string;
  category: UserRoleCategory;
  avatar: string;
  email: string;
  department: string;
  activeProject: string;
}

// -------------------------------------------------------------
// TRACK 2: MARKETING & SALES CRM TYPES (All 36 & 23 Fields)
// -------------------------------------------------------------

export type MarketingRepName = "Kamil" | "Anusha" | "Priya" | string;

export type LeadStageStatus =
  | "New Lead"
  | "Contacted"
  | "Meeting Scheduled"
  | "Demo Completed"
  | "Proposal Sent"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost"
  | "On Hold";

export type InteractionType =
  | "Intro Meeting"
  | "Product Demo"
  | "Follow-up"
  | "Commercial Negotiation"
  | "Technical Scoping"
  | "Check-in";

export type LeadSource =
  | "Website / Inbound"
  | "Field Visit / Direct Walk-in"
  | "Referral"
  | "LinkedIn / Outreach"
  | "Exhibition / Event"
  | "Cold Call";

export type InteractionOutcome =
  | "Positive - Advancing"
  | "Needs Demo"
  | "Proposal Requested"
  | "Follow-up Required"
  | "Cold / Unresponsive"
  | "Closed - Lost";

export type PriorityInterest = "Hot" | "Warm" | "Cold" | "High" | "Medium" | "Low";

export interface MarketingDeal {
  id: string;
  leadId: string; // e.g. LD-1001
  dateAdded: string; // YYYY-MM-DD
  marketingPerson: MarketingRepName;
  companyName: string;
  industry: string;
  contactPerson: string;
  designation: string;
  phoneNumber: string;
  emailAddress: string;
  officeAddress: string;
  city: string;
  stateRegion: string;
  googleMapsLink: string;
  leadSource: LeadSource | string;
  initialVisitDate: string;
  lastInteractionDate: string;
  visitType: InteractionType | string;
  isDecisionMaker: boolean;
  decisionMakerDetails: string;
  clientRequirements: string;
  solutionsPitched: string;
  budgetSpecified: number; // in INR ₹
  estimatedDealValue: number; // in INR ₹
  weightedValue: number; // formula: estimatedDealValue * stage probability
  demoRequired: "Not Needed" | "Scheduled" | "Completed";
  proposalSent: boolean;
  proposalValue: number; // in INR ₹
  leadStatus: LeadStageStatus;
  nextFollowUpDate: string;
  followUpAction: string;
  followUpPriority: "High" | "Medium" | "Low";
  followUpStatus: "Pending" | "In Progress" | "Completed" | "Overdue";
  daysSinceLastVisit: number;
  dueStatus: "Overdue" | "Today" | "Upcoming" | "Completed";
  conversionDate?: string;
  notesNextSteps: string;
}

export interface MarketingInteraction {
  id: string;
  date: string;
  marketingPerson: MarketingRepName;
  companyName: string;
  leadId: string;
  googleMapsLink: string;
  leadSource: LeadSource | string;
  interactionType: InteractionType | string;
  meetingMode: "Physical (On-site)" | "Virtual (Video)" | "Phone Call";
  personsMet: string;
  designation: string;
  phoneNumber: string;
  email: string;
  agenda: string;
  discussionFeedback: string;
  demoRequired: "Yes" | "No" | "Completed";
  interestLevel: "Hot" | "Warm" | "Cold";
  probabilityPct: number;
  interactionOutcome: InteractionOutcome | string;
  actionItemsAgreed: string;
  nextSteps: string;
  nextFollowUpDate: string;
  followUpPriority: "High" | "Medium" | "Low";
  loggedBy: string;
}

// -------------------------------------------------------------
// TRACK 3: FOUNDERS & EXECUTIVE COMMAND CENTER TYPES
// -------------------------------------------------------------

export interface FounderMatrixStats {
  founder: "Akshar" | "Abhinav" | "Adnaan" | "Bhuvan";
  role: string;
  clientsBrought: number;
  totalDealValue: number; // in INR ₹
  projectsLed: {
    total: number;
    active: number;
    completed: number;
    onHold: number;
  };
  pendingCollection: number; // in INR ₹
}

export type ProjectDeliveryStatus = "Completed" | "Development" | "Testing" | "Client Review" | "On Hold";

export interface ClientMasterRecord {
  id: string;
  clientId: string; // SF-001 to SF-008
  projectId?: string; // PRJ-001 to PRJ-005
  companyName: string;
  industry: string;
  salesOwner: "Akshar" | "Abhinav" | "Adnaan" | "Bhuvan";
  dealValue: number; // in INR ₹
  dealStatus: "Won" | "Negotiation" | "Proposal Sent" | "Discussion" | "On Hold";
  contractScope: string;
  signedDate: string;
  deliveryStatus: ProjectDeliveryStatus;
}

export interface ProjectProgressRecord {
  id: string;
  projectId: string; // PRJ-001 to PRJ-005
  clientId: string; // SF-001 to SF-005
  projectName: string;
  projectManager: "Akshar" | "Abhinav" | "Adnaan" | "Bhuvan";
  status: ProjectDeliveryStatus;
  completionPercentage: number; // e.g. 100, 60, 82.2, 88.9, 30
  blockerDetails: string;
  blockerOwner: string;
  targetReleaseDate: string;
}

export interface PaymentBillingRecord {
  id: string;
  invoiceId: string; // INV-2026-001 to INV-2026-007
  clientId: string; // SF-001 to SF-008
  projectId: string;
  companyName: string;
  invoicedAmount: number; // in INR ₹
  receivedAmount: number; // in INR ₹
  pendingAmount: number; // in INR ₹
  overdueAmount: number; // in INR ₹
  status: "Fully Paid" | "Pending" | "Overdue";
  dueDate: string;
  milestoneDescription: string;
}

export interface CompanyTopLineMetrics {
  totalClients: number; // 8
  activeProjects: number; // 5
  completedProjects: number; // 1
  projectsOnHold: number; // 1
  futureOpps: number; // 5
  totalDealValue: number; // ₹1,59,00,000 (₹1.59 Cr)
  totalInvoiced: number; // ₹7,800,000 (₹78 L)
  totalReceived: number; // ₹6,00,000 (₹60 L)
  totalPending: number; // ₹1,800,000 (₹18 L)
  overduePayments: number; // ₹6,00,000 (₹6 L)
}

export interface MarketingCampaign {
  id: string;
  name: string;
  client: string;
  platform: "Google Ads" | "Meta" | "LinkedIn" | "SEO / Content" | "Email / Outreach";
  budget: number;
  spent: number;
  leadsGenerated: number;
  status: "Active" | "Planning" | "Paused" | "Completed";
  owner: string;
  endDate: string;
}

export interface ClientBudgetRecord {
  id: string;
  clientName: string;
  projectName: string;
  totalContractValue: number;
  billedAmount: number;
  receivedAmount: number;
  pendingAmount: number;
  status: "Up to Date" | "Pending Invoice" | "Overdue" | "Retainer";
  nextMilestone: string;
  dueDate: string;
}

export interface GoogleSheetsConfig {
  sheetId: string;
  webAppUrl: string;
  autoSync: boolean;
  lastSyncedAt: string | null;
  status: "connected" | "disconnected" | "syncing" | "error";
  errorMessage?: string;
}
