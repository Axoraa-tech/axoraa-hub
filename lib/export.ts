// CSV exports (Excel / Google Sheets friendly: UTF-8 BOM, quoted cells).
import type {
  ActivityEvent,
  AgentDraft,
  Campaign,
  ClientMasterRecord,
  ContentPost,
  DailyWorkLogEntry,
  DeveloperRosterMember,
  MarketingDeal,
  MarketingInteraction,
  PaymentBillingRecord,
  ProjectProgressRecord,
  RepositoryMapping,
} from "./types";
import { csvSafe } from "./format";

export interface Column<T> {
  header: string;
  value: (row: T) => string | number | boolean | undefined | null;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  // csvSafe stops spreadsheet apps from running a cell that starts with = + - @ as a formula.
  const esc = (v: unknown) => `"${String(csvSafe(v ?? "")).replace(/"/g, '""')}"`;
  return [columns.map((c) => esc(c.header)).join(","), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(","))].join(
    "\r\n"
  );
}

export function downloadCsv<T>(filename: string, rows: T[], columns: Column<T>[]) {
  const blob = new Blob(["﻿" + toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pretty-printed JSON download (used for full backups). */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const WORK_LOG_COLUMNS: Column<DailyWorkLogEntry>[] = [
  { header: "Date", value: (r) => r.date },
  { header: "Developer Name", value: (r) => r.developerName },
  { header: "Project", value: (r) => r.project },
  { header: "Repository", value: (r) => r.repository },
  { header: "Module / Feature Area", value: (r) => r.module },
  { header: "Work Type", value: (r) => r.workType },
  { header: "Task / Work Description", value: (r) => r.taskDescription },
  { header: "GitHub PR Number", value: (r) => r.githubPr },
  { header: "Work Status", value: (r) => r.workStatus },
  { header: "Priority", value: (r) => r.priority },
  { header: "Hours / Effort", value: (r) => r.hours },
  { header: "Blocked?", value: (r) => r.isBlocked },
  { header: "Blocker / Dependency", value: (r) => r.blockerDetails },
  { header: "Review Required?", value: (r) => r.reviewRequired },
  { header: "Reviewer", value: (r) => r.reviewer },
  { header: "Deployment / Release", value: (r) => r.deployment },
  { header: "Production Impact", value: (r) => r.productionImpact },
  { header: "Notes", value: (r) => r.notes },
  { header: "Last Updated", value: (r) => r.lastUpdated },
];

export const DEAL_COLUMNS: Column<MarketingDeal>[] = [
  { header: "Lead ID", value: (r) => r.leadId },
  { header: "Date Added", value: (r) => r.dateAdded },
  { header: "Marketing Person", value: (r) => r.marketingPerson },
  { header: "Company", value: (r) => r.companyName },
  { header: "Industry", value: (r) => r.industry },
  { header: "Contact Person", value: (r) => r.contactPerson },
  { header: "Designation", value: (r) => r.designation },
  { header: "Phone", value: (r) => r.phoneNumber },
  { header: "Email", value: (r) => r.emailAddress },
  { header: "City", value: (r) => r.city },
  { header: "Lead Source", value: (r) => r.leadSource },
  { header: "Lead Status", value: (r) => r.leadStatus },
  { header: "Estimated Deal Value (INR)", value: (r) => r.estimatedDealValue },
  { header: "Weighted Value (INR)", value: (r) => r.weightedValue },
  { header: "Proposal Sent", value: (r) => (r.proposalSent ? "Yes" : "No") },
  { header: "Last Interaction", value: (r) => r.lastInteractionDate },
  { header: "Next Follow-up", value: (r) => r.nextFollowUpDate },
  { header: "Follow-up Action", value: (r) => r.followUpAction },
  { header: "Follow-up Priority", value: (r) => r.followUpPriority },
  { header: "Due Status", value: (r) => r.dueStatus },
  { header: "Notes / Next Steps", value: (r) => r.notesNextSteps },
  { header: "Quote Number", value: (r) => r.quoteNumber },
  { header: "External Source", value: (r) => r.externalSource },
  { header: "Campaign ID", value: (r) => r.campaignId },
];

export const INTERACTION_COLUMNS: Column<MarketingInteraction>[] = [
  { header: "Date", value: (r) => r.date },
  { header: "Marketing Person", value: (r) => r.marketingPerson },
  { header: "Company", value: (r) => r.companyName },
  { header: "Lead ID", value: (r) => r.leadId },
  { header: "Interaction Type", value: (r) => r.interactionType },
  { header: "Meeting Mode", value: (r) => r.meetingMode },
  { header: "Persons Met", value: (r) => r.personsMet },
  { header: "Agenda", value: (r) => r.agenda },
  { header: "Discussion / Feedback", value: (r) => r.discussionFeedback },
  { header: "Interest Level", value: (r) => r.interestLevel },
  { header: "Probability %", value: (r) => r.probabilityPct },
  { header: "Outcome", value: (r) => r.interactionOutcome },
  { header: "Next Steps", value: (r) => r.nextSteps },
  { header: "Next Follow-up", value: (r) => r.nextFollowUpDate },
];

export const CLIENT_COLUMNS: Column<ClientMasterRecord>[] = [
  { header: "Client ID", value: (r) => r.clientId },
  { header: "Project ID", value: (r) => r.projectId },
  { header: "Company", value: (r) => r.companyName },
  { header: "Industry", value: (r) => r.industry },
  { header: "Founder Owner", value: (r) => r.salesOwner },
  { header: "Deal Value (INR)", value: (r) => r.dealValue },
  { header: "Deal Status", value: (r) => r.dealStatus },
  { header: "Delivery Status", value: (r) => r.deliveryStatus },
  { header: "Signed Date", value: (r) => r.signedDate },
  { header: "Contract Scope", value: (r) => r.contractScope },
  { header: "Contact Person", value: (r) => r.contactPerson },
  { header: "Contact Email", value: (r) => r.contactEmail },
  { header: "Contact Phone", value: (r) => r.contactPhone },
  { header: "GSTIN", value: (r) => r.gstin },
  { header: "State", value: (r) => r.state },
  { header: "Billing Address", value: (r) => r.billingAddress },
];

export const PROJECT_COLUMNS: Column<ProjectProgressRecord>[] = [
  { header: "Project ID", value: (r) => r.projectId },
  { header: "Client ID", value: (r) => r.clientId },
  { header: "Project", value: (r) => r.projectName },
  { header: "Project Manager", value: (r) => r.projectManager },
  { header: "Status", value: (r) => r.status },
  { header: "Completion %", value: (r) => r.completionPercentage },
  { header: "Blocker", value: (r) => r.blockerDetails },
  { header: "Blocker Owner", value: (r) => r.blockerOwner },
  { header: "Target Release", value: (r) => r.targetReleaseDate },
];

export const PAYMENT_COLUMNS: Column<PaymentBillingRecord>[] = [
  { header: "Invoice ID", value: (r) => r.invoiceId },
  { header: "Client ID", value: (r) => r.clientId },
  { header: "Company", value: (r) => r.companyName },
  { header: "Invoiced (INR)", value: (r) => r.invoicedAmount },
  { header: "Received (INR)", value: (r) => r.receivedAmount },
  { header: "Pending (INR)", value: (r) => r.pendingAmount },
  { header: "Overdue (INR)", value: (r) => r.overdueAmount },
  { header: "Status", value: (r) => r.status },
  { header: "Due Date", value: (r) => r.dueDate },
  { header: "Milestone", value: (r) => r.milestoneDescription },
  { header: "Issue Date", value: (r) => r.issueDate },
  { header: "Taxable Value (INR)", value: (r) => r.taxableAmount },
  { header: "GST Rate %", value: (r) => r.gstRate ?? 18 },
  { header: "Place of Supply", value: (r) => r.placeOfSupply },
  { header: "SAC", value: (r) => r.sac },
  { header: "TDS (INR)", value: (r) => (r.payments ?? []).reduce((s, p) => s + (Number(p.tdsAmount) || 0), 0) },
  { header: "Payments Recorded", value: (r) => (r.payments ?? []).length },
];

export const POST_COLUMNS: Column<ContentPost>[] = [
  { header: "Title", value: (r) => r.title },
  { header: "Channel", value: (r) => r.channel },
  { header: "Status", value: (r) => r.status },
  { header: "Scheduled At", value: (r) => r.scheduledAt },
  { header: "Published At", value: (r) => r.publishedAt },
  { header: "Owner", value: (r) => r.ownerName },
  { header: "Caption", value: (r) => r.caption },
  { header: "Hashtags", value: (r) => (r.hashtags ?? []).join(" ") },
  { header: "Campaign ID", value: (r) => r.campaignId },
  { header: "Permalink", value: (r) => r.permalink },
  { header: "Reach", value: (r) => r.metrics?.reach ?? "" },
  { header: "Engagements", value: (r) => r.metrics?.engagements ?? "" },
];

export const CAMPAIGN_COLUMNS: Column<Campaign>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Platform", value: (r) => r.platform },
  { header: "Objective", value: (r) => r.objective },
  { header: "Status", value: (r) => r.status },
  { header: "Start Date", value: (r) => r.startDate },
  { header: "End Date", value: (r) => r.endDate },
  { header: "Daily Budget (INR)", value: (r) => r.dailyBudget },
  { header: "Total Budget (INR)", value: (r) => r.totalBudget },
  { header: "Spend (INR)", value: (r) => r.spend },
  { header: "Leads", value: (r) => r.leads },
  { header: "Owner", value: (r) => r.ownerName },
  { header: "Audience", value: (r) => r.audience },
  { header: "Source", value: (r) => r.source },
  { header: "Notes", value: (r) => r.notes },
];

export const DRAFT_COLUMNS: Column<AgentDraft>[] = [
  { header: "Created At", value: (r) => r.createdAt },
  { header: "Agent", value: (r) => r.agentKey },
  { header: "Title", value: (r) => r.title },
  { header: "Status", value: (r) => r.status },
  { header: "Created By", value: (r) => r.createdByName },
  { header: "Language", value: (r) => r.language },
  { header: "Record", value: (r) => (r.ref ? `${r.ref.type}:${r.ref.id}` : "") },
  { header: "Model", value: (r) => r.model },
  { header: "Input Tokens", value: (r) => r.usage?.inputTokens },
  { header: "Output Tokens", value: (r) => r.usage?.outputTokens },
];

export const ACTIVITY_COLUMNS: Column<ActivityEvent>[] = [
  { header: "At", value: (r) => r.at },
  { header: "Person", value: (r) => r.actorName },
  { header: "Action", value: (r) => r.action },
  { header: "Record Type", value: (r) => r.entity },
  { header: "Record ID", value: (r) => r.entityId },
  { header: "Summary", value: (r) => r.summary },
];

export const ROSTER_COLUMNS: Column<DeveloperRosterMember>[] = [
  { header: "Name", value: (r) => r.developerName },
  { header: "Role", value: (r) => r.role },
  { header: "Primary Area", value: (r) => r.primaryArea },
  { header: "Active", value: (r) => r.active },
  { header: "Joining Date", value: (r) => r.joiningDate },
  { header: "Notes", value: (r) => r.notes },
];

export const REPOSITORY_COLUMNS: Column<RepositoryMapping>[] = [
  { header: "Project", value: (r) => r.projectName },
  { header: "Repository", value: (r) => r.repository },
  { header: "Type", value: (r) => r.type },
  { header: "Status", value: (r) => r.status },
  { header: "Description", value: (r) => r.description },
];
