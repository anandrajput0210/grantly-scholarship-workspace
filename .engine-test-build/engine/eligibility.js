function readProfileField(profile, field) {
    return profile[field];
}
function isMissing(value) {
    return value === undefined || value === null || value === '';
}
function asComparableNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return undefined;
}
function compareRequirement(value, requirement) {
    const expected = requirement.expectedValue;
    switch (requirement.operator) {
        case 'exists':
            return !isMissing(value);
        case 'equals':
            return value === expected;
        case 'not_equals':
            return value !== expected;
        case 'one_of':
            return Array.isArray(expected) && expected.includes(String(value));
        case 'greater_than': {
            const actualNumber = asComparableNumber(value);
            const expectedNumber = asComparableNumber(expected);
            return actualNumber !== undefined && expectedNumber !== undefined && actualNumber > expectedNumber;
        }
        case 'less_than': {
            const actualNumber = asComparableNumber(value);
            const expectedNumber = asComparableNumber(expected);
            return actualNumber !== undefined && expectedNumber !== undefined && actualNumber < expectedNumber;
        }
        case 'greater_than_or_equal': {
            const actualNumber = asComparableNumber(value);
            const expectedNumber = asComparableNumber(expected);
            return actualNumber !== undefined && expectedNumber !== undefined && actualNumber >= expectedNumber;
        }
        case 'less_than_or_equal': {
            const actualNumber = asComparableNumber(value);
            const expectedNumber = asComparableNumber(expected);
            return actualNumber !== undefined && expectedNumber !== undefined && actualNumber <= expectedNumber;
        }
        default:
            return false;
    }
}
function formatExpected(requirement) {
    const value = requirement.expectedValue;
    if (Array.isArray(value))
        return value.join(', ');
    if (typeof value === 'number' && requirement.field === 'familyIncome') {
        return `₹${value.toLocaleString('en-IN')}`;
    }
    if (value === undefined)
        return 'a value';
    return String(value);
}
function evaluateRequirement(profile, requirement, documents) {
    const value = readProfileField(profile, requirement.field);
    if (isMissing(value)) {
        return {
            requirementId: requirement.id,
            label: requirement.label,
            status: 'needs_verification',
            explanation: `${requirement.field === 'gpa' ? 'Your academic score' : requirement.field === 'familyIncome' ? 'Your annual family income' : `Your ${requirement.field}`} is not in your profile, so this condition cannot be assessed yet.`,
            nextAction: requirement.failureAction ?? `Add ${requirement.field} to your student profile.`,
        };
    }
    const passes = compareRequirement(value, requirement);
    if (!passes) {
        const comparison = requirement.operator === 'greater_than' || requirement.operator === 'greater_than_or_equal'
            ? 'at least'
            : requirement.operator === 'less_than' || requirement.operator === 'less_than_or_equal'
                ? 'at most'
                : 'one of';
        return {
            requirementId: requirement.id,
            label: requirement.label,
            status: 'not_matched',
            explanation: `Your recorded ${requirement.field} value (${String(value)}) does not meet the stated condition (${comparison} ${formatExpected(requirement)}).`,
            nextAction: requirement.failureAction ?? 'Review this condition against the official scholarship rules.',
        };
    }
    if (requirement.requiredDocumentId) {
        const document = documents.find((item) => item.id === requirement.requiredDocumentId);
        if (!document || document.status === 'missing') {
            return {
                requirementId: requirement.id,
                label: requirement.label,
                status: 'document_missing',
                explanation: 'Your profile meets the associated condition, but the supporting document has not been marked as available.',
                nextAction: `Prepare ${document?.label.toLowerCase() ?? 'the required document'}.`,
            };
        }
        if (document.status === 'uploaded') {
            return {
                requirementId: requirement.id,
                label: requirement.label,
                status: 'needs_verification',
                explanation: `${document.label} is marked as uploaded but has not been verified in this demo workflow.`,
                nextAction: `Verify ${document.label.toLowerCase()}.`,
            };
        }
    }
    return {
        requirementId: requirement.id,
        label: requirement.label,
        status: 'matched',
        explanation: 'Your recorded information satisfies this condition.',
    };
}
export function evaluateEligibility(profile, scholarship, documents) {
    const results = scholarship.requirements.map((requirement) => evaluateRequirement(profile, requirement, documents));
    const blockers = results.filter((result) => result.status !== 'matched');
    const matchedCount = results.filter((result) => result.status === 'matched').length;
    const readinessScore = results.length === 0 ? 100 : Math.round((matchedCount / results.length) * 100);
    return {
        scholarshipId: scholarship.id,
        results,
        blockers,
        canApply: blockers.length === 0,
        readinessScore,
    };
}
export function generateNextActions(assessment, scholarship, application, now = new Date()) {
    const actions = [];
    const [year, month, day] = scholarship.deadline.split('-').map(Number);
    const deadlineTime = Date.UTC(year, month - 1, day);
    const todayTime = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntilDeadline = Math.round((deadlineTime - todayTime) / 86400000);
    const isSubmittedOrClosed = application
        ? ['applied', 'under_review', 'completed'].includes(application.stage)
        : false;
    // Do not ask students to prepare documents or verify information after they have
    // already submitted the application or the record has been closed.
    if (!isSubmittedOrClosed && daysUntilDeadline >= 0) {
        assessment.results.forEach((result) => {
            if (result.status !== 'needs_verification' && result.status !== 'document_missing')
                return;
            // Determine the action from the structured requirement, never from copy text.
            // A requirement tied to a document belongs in the Document Center; a profile
            // field gap belongs in the Profile editor.
            const requirement = scholarship.requirements.find((item) => item.id === result.requirementId);
            const isDocumentRequirement = Boolean(requirement?.requiredDocumentId);
            const priority = daysUntilDeadline <= 3
                ? 'high'
                : daysUntilDeadline <= 14
                    ? 'medium'
                    : 'low';
            actions.push({
                id: `${assessment.scholarshipId}-${result.requirementId}-action`,
                priority,
                title: result.nextAction ?? (result.status === 'document_missing' ? 'Prepare a required document' : 'Verify your information'),
                description: `${result.explanation} · ${scholarship.title}`,
                scholarshipId: scholarship.id,
                actionType: isDocumentRequirement ? 'upload_document' : 'verify_profile',
            });
        });
    }
    // Deadline reminders remain useful for saved/preparing/ready opportunities, but
    // are suppressed once an application has been submitted or closed.
    if (!isSubmittedOrClosed &&
        daysUntilDeadline >= 0 &&
        daysUntilDeadline <= 14) {
        actions.push({
            id: `${scholarship.id}-deadline-action`,
            priority: daysUntilDeadline <= 3 ? 'high' : 'medium',
            title: daysUntilDeadline === 0 ? 'Review today’s deadline' : daysUntilDeadline === 1 ? 'Review tomorrow’s deadline' : `Review deadline in ${daysUntilDeadline} days`,
            description: `${scholarship.title} · Due ${new Date(`${scholarship.deadline}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
            scholarshipId: scholarship.id,
            actionType: 'review_deadline',
        });
    }
    return actions;
}
/** A date-only deadline check used to prevent new submissions after closing. */
export function isDeadlineOpenForApplication(deadline, now = new Date()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
    if (!match)
        return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const deadlineUtc = Date.UTC(year, month - 1, day);
    const parsed = new Date(deadlineUtc);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
        return false;
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return deadlineUtc >= todayUtc;
}
/** Validates the two stages that represent an application being ready to submit. */
export function validateApplicationStageChange(application, nextStage, assessment, now = new Date()) {
    if (nextStage === application.stage)
        return { allowed: true };
    const submittedStages = ['applied', 'under_review', 'completed'];
    if (submittedStages.includes(application.stage) && submittedStages.includes(nextStage)) {
        return { allowed: true };
    }
    if (submittedStages.includes(application.stage) && !submittedStages.includes(nextStage)) {
        return { allowed: false, reason: 'This application has already been submitted. Keep it in the submitted or outcome stages rather than reopening preparation.' };
    }
    if (nextStage === 'under_review' && !['applied', 'under_review'].includes(application.stage)) {
        return { allowed: false, reason: 'Mark the application as applied before moving it into review.' };
    }
    if (nextStage === 'completed' && !submittedStages.includes(application.stage)) {
        return { allowed: false, reason: 'Only a submitted application can be marked completed.' };
    }
    if (nextStage !== 'ready' && nextStage !== 'applied')
        return { allowed: true };
    if (!isDeadlineOpenForApplication(application.deadline, now)) {
        return { allowed: false, reason: 'This scholarship deadline has passed or is unavailable. You cannot mark a new submission as ready or applied.' };
    }
    if (!assessment.canApply) {
        return { allowed: false, reason: 'Resolve the outstanding eligibility requirements before marking this application ready.' };
    }
    if (application.checklist.length === 0 || !application.checklist.every((item) => item.completed)) {
        return { allowed: false, reason: 'Complete the preparation checklist before marking this application ready.' };
    }
    return { allowed: true };
}
/**
 * Keeps the preparation stage consistent with current eligibility, checklist data,
 * and the application window. Historical submitted stages are preserved.
 */
export function reconcileApplicationStage(application, assessment, now = new Date()) {
    if (['applied', 'under_review', 'completed'].includes(application.stage))
        return application;
    const checklistComplete = application.checklist.length > 0 && application.checklist.every((item) => item.completed);
    const requirementsAndChecklistReady = assessment.canApply && checklistComplete;
    if (application.stage === 'ready' && !requirementsAndChecklistReady) {
        return { ...application, stage: 'preparing' };
    }
    if ((application.stage === 'saved' || application.stage === 'preparing') &&
        requirementsAndChecklistReady &&
        isDeadlineOpenForApplication(application.deadline, now)) {
        return { ...application, stage: 'ready' };
    }
    return application;
}
export function calculateApplicationReadiness(assessment, checklist) {
    // Application preparation is measured separately from eligibility assessment.
    // The eligibility argument is kept in the API so callers can calculate both side by side.
    void assessment;
    return checklist.length === 0
        ? 100
        : Math.round((checklist.filter((item) => item.completed).length / checklist.length) * 100);
}
