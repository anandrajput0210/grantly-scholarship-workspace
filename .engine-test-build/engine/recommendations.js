/** Date-only calculation avoids timezone/DST drift around midnight. */
export function getDeadlineInfo(deadline, now = new Date()) {
    const [year, month, day] = deadline.split('-').map(Number);
    if (!year || !month || !day) {
        return { daysUntilDeadline: null, label: 'Date unavailable', urgency: 'none' };
    }
    const deadlineUtc = Date.UTC(year, month - 1, day);
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntilDeadline = Math.round((deadlineUtc - todayUtc) / 86400000);
    if (daysUntilDeadline < 0) {
        const daysAgo = Math.abs(daysUntilDeadline);
        return { daysUntilDeadline, label: `Closed ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`, urgency: 'closed' };
    }
    if (daysUntilDeadline === 0) {
        return { daysUntilDeadline, label: 'Due today', urgency: 'high' };
    }
    return {
        daysUntilDeadline,
        label: `${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} left`,
        urgency: daysUntilDeadline <= 3 ? 'high' : daysUntilDeadline <= 14 ? 'medium' : 'low',
    };
}
/**
 * Completeness is a profile-quality measure only. It is not an eligibility score.
 * Academic and financial fields are counted because they are used by the demo catalogue.
 */
export function getProfileCompleteness(profile) {
    // Keep identity and study context as core fields. GPA, income, and applicant
    // category can improve matching, but remain optional so users are not pushed
    // to disclose academic or sensitive financial/category information.
    const coreChecks = [
        ['Full name', Boolean(profile.name.trim())],
        ['Email address', Boolean(profile.email.trim())],
        ['Study level', Boolean(profile.level)],
        ['State or union territory', Boolean(profile.state.trim())],
    ];
    const optionalChecks = [
        ['Academic score', typeof profile.gpa === 'number' && Number.isFinite(profile.gpa)],
        ['Annual family income', typeof profile.familyIncome === 'number' && Number.isFinite(profile.familyIncome)],
        ['Applicant category', Boolean(profile.category.trim())],
    ];
    const completed = coreChecks.filter(([, isComplete]) => isComplete).length;
    return {
        score: Math.round((completed / coreChecks.length) * 100),
        completed,
        total: coreChecks.length,
        missing: coreChecks.filter(([, isComplete]) => !isComplete).map(([label]) => label),
        optionalMissing: optionalChecks.filter(([, isComplete]) => !isComplete).map(([label]) => label),
    };
}
/**
 * Ranks opportunities using explicit requirement outcomes. A matched requirement
 * contributes 1 point, an unresolved/document state contributes 0.5, and a hard
 * mismatch contributes 0. The result is a profile-fit index, never an award probability.
 */
export function rankScholarships(scholarships, assessments, now = new Date()) {
    const ranked = scholarships.map((scholarship) => {
        const assessment = assessments[scholarship.id];
        const matched = assessment.results.filter((result) => result.status === 'matched').length;
        const unresolved = assessment.results.filter((result) => result.status === 'needs_verification' || result.status === 'document_missing').length;
        const mismatched = assessment.results.filter((result) => result.status === 'not_matched').length;
        const fitScore = assessment.results.length === 0
            ? 100
            : Math.round(((matched + unresolved * 0.5) / assessment.results.length) * 100);
        const deadline = getDeadlineInfo(scholarship.deadline, now);
        const fitLabel = deadline.urgency === 'closed'
            ? 'Deadline passed'
            : mismatched > 0
                ? 'Review fit'
                : unresolved > 0
                    ? 'Potential fit'
                    : 'Strong fit';
        const reasons = [];
        if (mismatched > 0)
            reasons.push(`${mismatched} requirement${mismatched === 1 ? '' : 's'} do not currently match`);
        else if (unresolved > 0)
            reasons.push(`${unresolved} item${unresolved === 1 ? '' : 's'} ${unresolved === 1 ? 'needs' : 'need'} verification or a document`);
        else
            reasons.push('All listed requirements currently match');
        reasons.push(`${matched} of ${assessment.results.length} requirements currently matched`);
        if (deadline.daysUntilDeadline !== null && deadline.daysUntilDeadline >= 0) {
            reasons.push(`Application ${deadline.label.toLowerCase()}`);
        }
        return { scholarship, assessment, fitScore, fitLabel, reasons, deadline };
    });
    const fitOrder = (item) => {
        if (item.fitLabel === 'Deadline passed')
            return 3;
        if (item.fitLabel === 'Review fit')
            return 2;
        if (item.fitLabel === 'Potential fit')
            return 1;
        return 0;
    };
    return ranked.sort((a, b) => fitOrder(a) - fitOrder(b) ||
        b.fitScore - a.fitScore ||
        (a.deadline.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER) - (b.deadline.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER) ||
        b.scholarship.amount - a.scholarship.amount);
}
/** Upcoming deadlines sort before closed or unavailable opportunities. */
export function sortRecommendationsByDeadline(items) {
    return [...items].sort((a, b) => {
        const aClosed = a.deadline.daysUntilDeadline === null || a.deadline.daysUntilDeadline < 0 ? 1 : 0;
        const bClosed = b.deadline.daysUntilDeadline === null || b.deadline.daysUntilDeadline < 0 ? 1 : 0;
        return aClosed - bClosed ||
            (a.deadline.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER) - (b.deadline.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER) ||
            b.fitScore - a.fitScore;
    });
}
