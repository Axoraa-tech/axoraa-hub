# Axoraa Hub: SOP and guide

How the team uses the hub, step by step, and who to ask. This is the printable copy of the **SOP & guide** page in the hub (`lib/help-content.ts`); the page also shows your live sync status.

Questions: info@axoraa.com

---

## Your day

### Developers

- **Log your work by 7 pm.** Open My work log and add what you did today with hours, project and PR link. It takes about two minutes.
- **Flag blockers within the hour.** Stuck for more than an hour? Set the entry to Blocked so the tech lead can unblock you the same day.
- **Clear reviews waiting on you.** My dashboard lists the logs where you are named as reviewer.

### Marketing

- **Log visits the same day.** Add every visit and call in My visits before you finish for the day, linked to its deal.
- **Keep every follow-up dated.** Each open lead needs a next follow-up date and action. Overdue ones show first on My dashboard.
- **Move deals when they change.** Update the stage after a meeting, demo or proposal so the pipeline stays true.

### Founders

- **Review blockers.** Open blockers show on My dashboard. Anything older than 24 hours needs a decision from you.
- **Look after your clients.** My clients shows delivery status and what each client still owes.
- **Log your own work.** Your hours count towards the team dashboard, so log them by 7 pm like everyone else.

### Administrator

- **Start with Needs attention.** The Command Center lists overdue follow-ups, blockers, reviews, invoices due and missing work logs.
- **Check the sync line.** The sidebar shows where data is saved and how many changes have not reached Google Sheets yet.
- **Assign new leads.** Meta leads without an owner wait in the Deal tracker until you assign them.

---

## Daily routine

The engineering team's steps, in order.

1. Locate your entry row or click '+ Log Work' in the Daily Work Log.
2. Build and push your PR in your local IDE and create the PR on GitHub (for example #142).
3. Flag blockers fast: if blocked for more than 1 hour, immediately set Blocked? = 'Yes'.
4. Log daily work and effort hours (typically 6.0 to 8.0 hrs/day) before signing off.
5. Review dashboard metrics and check blocker triage is resolved before sprint review.

---

## Escalation

| Level | When | What to do |
| --- | --- | --- |
| **P1** Critical blocker | Production outage, broken master build, security vulnerability, full sprint stoppage | Set Status = Blocked, Blocked? = Yes, Priority = Critical. Immediately post in #engineering-alerts and tag Akshar. |
| **P2** High blocker | Waiting on a third-party API key, database access, AWS IAM credentials, or a stalled staging environment | Log it in the work log; flag it in standup or tag Manish in team chat. |
| **P3** Medium dependency | Waiting on peer code review, a design token clarification, or PR merge sign-off | Set Status = In Progress, Review? = Yes, and assign the reviewer. |
| **P4** Low or clarification | Minor UI styling, documentation wording, a non-blocking question | Add a note on the entry and raise it in the next engineering sync. |

**P1: email info@axoraa.com and call the tech lead.**

---

## Golden rules

- **Daily logging.** Do: log work daily before signing off (about 2 minutes). Avoid: postponing logging to the end of the week or sprint.
- **Dropdown fields.** Do: always pick from the lists (Status, Priority, Repo, Work type). Avoid: typing your own values into those fields.
- **Work hours.** Do: log realistic effort (typically 6.0 to 8.0 hrs/day in total). Avoid: leaving hours blank or entering 0 for completed tasks.
- **Blockers.** Do: flag immediately if stuck for more than an hour so the lead can unblock you. Avoid: waiting silently until the next morning's standup.
- **Sheet integrity.** Do: update only your own rows, or use the hub's form. Avoid: deleting columns, breaking formulas, or changing the Config tab without the tech lead's sign-off.

---

## Client email rules

1. **Always cc info@axoraa.com.** The shared inbox keeps a copy of every client thread, so anyone can pick it up.
2. **Use the deal's Email action.** It fills in the client's address, the cc and your signature for you.
3. **Choose your email app in the user menu.** Default mail app, Gmail or Outlook. The hub opens a draft; you press send.
4. **Read and edit assistant drafts before sending.** A draft can get a name, date or amount wrong. Nothing goes out without you.

---

## Where your data lives

The SOP & guide page shows your live status: where work logs and other records are saved, how many changes have not reached Google Sheets (with Retry), and whether demo rows are showing.

- **This browser.** Records are saved in this browser only. Your phone or another laptop will not see them, and clearing browser data removes them. Export center makes a full backup.
- **Google Sheet.** Records are saved to the team's Google Sheet through the hub's server, and everyone sees the same data. The sheet's address and key never reach your browser.
- **Script version 1.** Only work logs are shared. Deals, visits, clients, invoices, content, campaigns, drafts and settings stay in each person's browser.
- **Script version 2.** Everything is shared. Each person uploads the records saved only in their browser once, from My dashboard. Demo rows are never uploaded.

If a save fails, the record stays on your device marked "not saved to Google Sheets". Press Retry on the sync line, or on the SOP & guide page.

---

## Assistant

For the administrator, marketing, and founders (Research a prospect only).

- **What it does.** Drafts follow-ups, visit notes, prospect briefs, proposal outlines, social posts, Meta campaign plans, pipeline reviews and payment reminders, in English, Kannada or Hindi where it applies.
- **Drafts only.** Every result is saved as a draft under Assistant, History. Nothing is emailed, posted or written to a deal until you click.
- **What it never sees.** Phone numbers and email addresses are removed before anything is sent to the model, along with office addresses and map links. The hub fills them back in on your screen.

---

## Keyboard shortcuts

| Keys | Does |
| --- | --- |
| Ctrl K (⌘ K on a Mac) | Open the command bar |
| / | Search this page |
| N | Add a new item on this page |
| ? | Show every shortcut |
| Esc | Close a panel, menu or dialog |
| G then T | Go to My dashboard |
| G then O | Go to Command Center (admin) |
| G then D | Go to Deal tracker or My leads |
| G then V | Go to Visit log or My visits |
| G then A | Go to Assistant |
| G then I | Go to Invoices (admin) |
| G then L | Go to Daily work log or My work log |
| G then S | Go to Settings (admin) |

The G shortcuts work only for pages in your menu. Shortcuts pause while you are typing in a field or a dialog is open.

---

## Contact

- Questions about the hub, access, or something that looks wrong: **info@axoraa.com**
- Ask the administrator for password resets.
- Trouble signing in? The sign-in page has an "Email info@axoraa.com" link that fills in your username.
