/**
 * Seed script — Legal & Disclaimers sections
 *
 * Source: "Disclaimer & Notice Package for a Coding, Documentation &
 * Modifier Validation App" — ProEd Consulting and Staffing compliance
 * working draft. Bracketed placeholders ([APP NAME], [COMPANY], [YEAR])
 * filled in as the source document itself instructs before publication:
 *   [APP NAME] -> ProEdCS Coder AI
 *   [COMPANY]  -> ProEd Consulting & Staffing
 *   [YEAR]     -> 2026
 *
 * Sections marked PENDING_LICENSE are required "once CPT content is
 * displayed" per the source document — since the app currently shows no
 * real CPT codes anywhere, these are seeded but flagged inactive, same
 * "ready but not yet needed" pattern used elsewhere in this app for
 * CPT-gated features. Every section is admin-editable after seeding —
 * this is the initial content only, not fixed forever.
 *
 * Run with: npm run seed:legal
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const APP_NAME = "ProEdCS Coder AI";
const COMPANY = "ProEd Consulting & Staffing";
const YEAR = "2026";

const SECTIONS: { sectionKey: string; title: string; content: string; status: "ACTIVE" | "PENDING_LICENSE"; sortOrder: number }[] = [
  {
    sectionKey: "point-and-click-license",
    title: "1. Point-and-Click License Agreement (First Use)",
    status: "PENDING_LICENSE",
    sortOrder: 10,
    content: `END-USER POINT-AND-CLICK LICENSE AGREEMENT

CPT codes, descriptions, and other data only are copyright ${YEAR} American Medical Association. All rights reserved. CPT is a registered trademark of the American Medical Association (AMA). You are authorized to use CPT only as contained herein for your personal, non-commercial reference use. Any use not authorized herein is prohibited, including making copies of CPT for resale, transferring copies to any party not bound by this agreement, creating any modified or derivative work of CPT, or making any commercial use of CPT. License to use CPT for any use not authorized herein must be obtained through the AMA, Intellectual Property Services, 330 N. Wabash Ave., Suite 39300, Chicago, IL 60611.

CPT is provided "as is" without warranty of any kind, either expressed or implied, including but not limited to the implied warranties of merchantability and fitness for a particular purpose. The AMA disclaims responsibility for any consequences or liability attributable to or related to any use, non-use, or interpretation of information contained or not contained in this file/product. The AMA does not directly or indirectly practice medicine or dispense medical services. Fee schedules, relative value units, conversion factors, and/or related components are not assigned by the AMA, are not part of CPT, and the AMA is not recommending their use.

U.S. Government End Users. CPT is commercial technical data developed exclusively at private expense by the American Medical Association. Applicable FARS/DFARS restrictions apply to Government use.

By clicking "I Accept" you acknowledge you have read and agree to this agreement, the Terms of Use, and the Privacy Policy.

[This agreement will be presented on first launch, with an affirmative "I Accept" click required, once ProEd's AMA CPT license is active.]`,
  },
  {
    sectionKey: "ama-cpt-notice",
    title: "2a. AMA / CPT® Copyright Notice",
    status: "PENDING_LICENSE",
    sortOrder: 20,
    content: `CPT codes, descriptions, and other data only are copyright ${YEAR} American Medical Association. All Rights Reserved. Applicable FARS/HHSARS apply.

Fee schedules, relative value units, conversion factors and/or related components are not assigned by the AMA, are not part of CPT, and the AMA is not recommending their use. The AMA does not directly or indirectly practice medicine or dispense medical services. The AMA assumes no liability for data contained or not contained herein.

CPT is a registered trademark of the American Medical Association.`,
  },
  {
    sectionKey: "cms-attribution",
    title: "2b. CMS Attribution",
    status: "ACTIVE",
    sortOrder: 30,
    content: `CMS DISCLAIMS RESPONSIBILITY FOR ANY LIABILITY ATTRIBUTABLE TO END-USER USE OF ANY CMS-PUBLISHED DATA. CMS WILL NOT BE LIABLE FOR ANY CLAIMS ATTRIBUTABLE TO ANY ERRORS, OMISSIONS, OR OTHER INACCURACIES IN THE INFORMATION OR MATERIAL. In no event shall CMS be liable for direct, indirect, special, incidental, or consequential damages arising out of the use of such information or material. End users do not act for or on behalf of CMS.`,
  },
  {
    sectionKey: "icd10-attribution",
    title: "2c. ICD-10-CM Attribution",
    status: "ACTIVE",
    sortOrder: 40,
    content: `ICD-10-CM is maintained by the National Center for Health Statistics (NCHS) and the Centers for Medicare & Medicaid Services (CMS). This application uses the ${YEAR} ICD-10-CM code set as published by CMS/NCHS and follows the ICD-10-CM Official Guidelines for Coding and Reporting. Users are responsible for confirming they are using the correct fiscal-year code set for the date of service.`,
  },
  {
    sectionKey: "persistent-footer-cpt",
    title: "3. Persistent Footer Copyright Statement (CPT/HCPCS Level I)",
    status: "PENDING_LICENSE",
    sortOrder: 50,
    content: `CPT only copyright ${YEAR} American Medical Association. All Rights Reserved. CPT is a registered trademark of the American Medical Association.

[This short statement will appear in the footer of every screen displaying CPT or HCPCS Level I content, once ProEd's AMA CPT license is active.]`,
  },
  {
    sectionKey: "educational-use",
    title: "4. Educational-Purpose & Not-Coding-Advice Disclaimer",
    status: "ACTIVE",
    sortOrder: 60,
    content: `EDUCATIONAL USE ONLY — NOT CODING, BILLING, LEGAL, OR MEDICAL ADVICE

${APP_NAME} is a reference and educational tool. Reasonable efforts have been made to provide accurate ICD-10-CM, HCPCS Level II, modifier, National Correct Coding Initiative (NCCI), and documentation-guideline information. However, the user bears sole responsibility for ensuring that the information submitted to any payer is accurate and that the clinical documentation supports the codes reported.

The information provided by ${APP_NAME} does not constitute:
• legal, medical, coding, billing, reimbursement, compliance, or regulatory advice;
• a certification, credential, or CEU credit unless expressly labeled as such;
• an official coding determination or a definitive source for coding claims; or
• a substitute for the independent professional judgment of a licensed provider, certified coder, or qualified compliance professional.

Coding and documentation rules change frequently. Medicare Administrative Contractors (MACs) and commercial third-party payers may adopt policies that vary from official coding guidelines and NCCI edits. Denials, audits, or recoupments may occur even when ${APP_NAME}'s references are followed.

Users should consult the ICD-10-CM Official Guidelines for Coding and Reporting, AHA Coding Clinic, CMS Manual System, applicable Local Coverage Determinations (LCDs), National Coverage Determinations (NCDs), and payer-specific policies before submitting any claim. Neither ${COMPANY}, nor its owners, employees, contractors, editors, contributors, or licensors warrant or guarantee that any data related to coding, documentation, or compliance will be applicable or appropriate in any particular situation. For advice tailored to your specific circumstances, consult a qualified coding, billing, compliance, or legal professional.`,
  },
  {
    sectionKey: "validation-ai-output",
    title: "5a. Validation-Engine & AI Output Disclaimer",
    status: "ACTIVE",
    sortOrder: 70,
    content: `VALIDATION AND SUGGESTED-CODE RESULTS

Any validation result, code suggestion, modifier recommendation, edit warning, or documentation-completeness score produced by ${APP_NAME} is informational only. All outputs are suggestions to be reviewed by a qualified human user. The final determination of code selection, modifier assignment, and claim submission remains the sole responsibility of the licensed provider, certified coder, and submitting organization.

${APP_NAME} does not:
• diagnose disease, recommend treatment, or evaluate the clinical appropriateness of any medical service;
• replace, supplement, or independently exercise clinical judgment;
• guarantee payment, medical necessity determinations, or the outcome of any audit; or
• constitute a medical device, and it is not intended for time-critical or emergency clinical decisions.

The engine reflects CMS, NCHS, and payer rules as published at the time of update; coding guidelines are subject to interpretation and payer variation, and prior versions may not reflect current guidance. Users must independently verify each recommendation against current official sources before acting on it.`,
  },
  {
    sectionKey: "generative-ai-notice",
    title: "5b. Generative-AI Notice",
    status: "ACTIVE",
    sortOrder: 80,
    content: `AI-GENERATED CONTENT: This response was produced in whole or in part by a generative artificial intelligence system. AI output may be incomplete, inaccurate, or out of date. Verify any coding, billing, or clinical statement against current official sources before use. This tool is not clinical decision support in the FDA-regulated sense and is not a medical device.`,
  },
  {
    sectionKey: "california-ab3030",
    title: "5c. California AI Notice (AB 3030) — If Patient-Facing",
    status: "ACTIVE",
    sortOrder: 90,
    content: `${APP_NAME} does not currently generate patient-facing communications. If a future feature produces written or verbal patient communications containing clinical information, California Health & Safety Code §1339.75 (AB 3030, effective January 1, 2025) requires a specific disclaimer identifying the communication as AI-generated, with instructions for reaching a human clinician — unless a licensed provider reviews the communication first.

Required notice, if that feature is ever built:
"This message was created with the assistance of generative artificial intelligence. If you have questions about your health or this communication, contact your provider to speak with a licensed healthcare professional."`,
  },
  {
    sectionKey: "phi-notice",
    title: "6. PHI & Privacy Notice",
    status: "ACTIVE",
    sortOrder: 100,
    content: `DO NOT ENTER PATIENT-IDENTIFIABLE INFORMATION. ${APP_NAME} is an educational and reference tool and is not designed to receive, store, or transmit Protected Health Information (PHI) as defined by HIPAA or "medical information" as defined by the California Confidentiality of Medical Information Act (CMIA).

Do not paste real patient names, dates of birth, medical record numbers, or other identifiers into any input field. Use de-identified or synthetic examples only. Users are solely responsible for any PHI they upload in violation of this notice.`,
  },
  {
    sectionKey: "ccpa-privacy",
    title: "6b. California Consumer Privacy (CCPA/CPRA)",
    status: "ACTIVE",
    sortOrder: 110,
    content: `${COMPANY} does not sell or share personal information as defined by the California Consumer Privacy Act (CCPA) / California Privacy Rights Act (CPRA). Personal information collected through account creation (name, email) is used solely to operate ${APP_NAME} for ${COMPANY}'s own staff and authorized client accounts.

California residents may contact ${COMPANY} to exercise rights of access, deletion, or correction regarding personal information held about them.`,
  },
  {
    sectionKey: "terms-of-use-liability",
    title: "7. Terms of Use — Liability, Warranty & Indemnity",
    status: "ACTIVE",
    sortOrder: 120,
    content: `AS-IS / NO WARRANTY

The Service is provided "as is" and "as available," without warranties of any kind, express or implied, including, without limitation, the implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. ${COMPANY} does not warrant that the Service, its content, or any coding or documentation suggestion will be accurate, complete, current, reliable, error-free, or uninterrupted, or that use of the Service will result in payment, approval, or avoidance of denials, audits, or penalties.

LIMITATION OF LIABILITY

To the maximum extent permitted by law, ${COMPANY}, its affiliates, licensors, and suppliers shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost data, claim denials, underpayments, overpayments, recoupments, or audit findings arising out of or related to use of or reliance on the Service, even if advised of the possibility of such damages.

USER RESPONSIBILITY / INDEMNITY

You are solely responsible for (i) any coding, billing, documentation, or compliance decision you make in reliance on the Service; (ii) verifying each recommendation against current official CMS, NCHS, AHA, and payer sources; (iii) ensuring that submitted claims are supported by the clinical documentation and comply with applicable laws, regulations, and payer policies; and (iv) any use of the Service in violation of applicable licensing terms. You agree to indemnify and hold harmless ${COMPANY} from and against any claims, damages, and expenses arising out of your use of the Service, your submission of any claim to a payer, or your breach of these Terms.`,
  },
];

async function main() {
  console.log("=== ProEd Coder AI — Legal Sections Seed ===\n");

  for (const s of SECTIONS) {
    await db.legalSection.upsert({
      where: { sectionKey: s.sectionKey },
      update: {}, // never overwrite admin edits on re-run — insert-if-missing only
      create: {
        sectionKey: s.sectionKey,
        title: s.title,
        content: s.content,
        status: s.status,
        sortOrder: s.sortOrder,
      },
    });
    console.log(`  ✓ ${s.sectionKey}`);
  }

  console.log(`\n✅ Seed complete — ${SECTIONS.length} sections ensured (existing edits, if any, were not overwritten).`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
