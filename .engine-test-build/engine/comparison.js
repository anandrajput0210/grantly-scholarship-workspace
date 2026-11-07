const currency = (amount) => `₹${amount.toLocaleString('en-IN')}`;
const readableDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
});
function describeLeaders(entries, score, compare) {
    if (entries.length === 0)
        return [];
    const best = entries.reduce((current, item) => compare(score(item), score(current)) > 0 ? item : current);
    return entries.filter((item) => compare(score(item), score(best)) === 0);
}
/** Produces independent comparison highlights, never a single overall winner. */
export function getComparisonHighlights(items) {
    if (items.length === 0)
        return [];
    const names = (leaders) => leaders.map((item) => item.scholarship.title).join(', ');
    const tiePrefix = (leaders) => leaders.length > 1 ? 'Shared by ' : '';
    const fitLeaders = describeLeaders(items, (item) => item.fitScore, (a, b) => a - b);
    const awardLeaders = describeLeaders(items, (item) => item.scholarship.amount, (a, b) => a - b);
    const openDeadlineItems = items.filter((item) => item.deadline.daysUntilDeadline !== null && item.deadline.daysUntilDeadline >= 0);
    const deadlineLeaders = openDeadlineItems.length
        ? openDeadlineItems.filter((item) => item.deadline.daysUntilDeadline === Math.min(...openDeadlineItems.map((candidate) => candidate.deadline.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER)))
        : [];
    const attentionCount = (item) => item.assessment.results.filter((result) => result.status !== 'matched').length;
    const attentionLeaders = describeLeaders(items, (item) => attentionCount(item), (a, b) => b - a);
    return [
        {
            id: 'profile-fit',
            label: 'Strongest profile fit',
            value: fitLeaders.length > 1 ? `Tie · ${fitLeaders[0].fitScore}/100` : `${fitLeaders[0].fitScore}/100`,
            detail: `${tiePrefix(fitLeaders)}${names(fitLeaders)}. This is a requirement-alignment index, not an award probability.`,
            scholarshipIds: fitLeaders.map((item) => item.scholarship.id),
            tone: 'green',
        },
        {
            id: 'award',
            label: 'Highest award amount',
            value: awardLeaders.length > 1 ? `Tie · ${currency(awardLeaders[0].scholarship.amount)}` : currency(awardLeaders[0].scholarship.amount),
            detail: `${tiePrefix(awardLeaders)}${names(awardLeaders)}. Compare award conditions with the provider's official terms.`,
            scholarshipIds: awardLeaders.map((item) => item.scholarship.id),
            tone: 'blue',
        },
        {
            id: 'deadline',
            label: 'Soonest open deadline',
            value: deadlineLeaders.length ? readableDate(deadlineLeaders[0].scholarship.deadline) : 'No open deadlines',
            detail: deadlineLeaders.length
                ? `${tiePrefix(deadlineLeaders)}${names(deadlineLeaders)}. ${deadlineLeaders[0].deadline.label}.`
                : 'Every selected opportunity has a past or unavailable deadline.',
            scholarshipIds: deadlineLeaders.map((item) => item.scholarship.id),
            tone: 'amber',
        },
        {
            id: 'attention',
            label: 'Fewest requirements needing attention',
            value: `${attentionCount(attentionLeaders[0])} item${attentionCount(attentionLeaders[0]) === 1 ? '' : 's'}`,
            detail: `${tiePrefix(attentionLeaders)}${names(attentionLeaders)}. Counts unresolved, missing-document, and not-matched requirements.`,
            scholarshipIds: attentionLeaders.map((item) => item.scholarship.id),
            tone: 'slate',
        },
    ];
}
export function summarizeRequirementAttention(item) {
    const counts = {
        verification: item.assessment.results.filter((result) => result.status === 'needs_verification').length,
        documents: item.assessment.results.filter((result) => result.status === 'document_missing').length,
        mismatched: item.assessment.results.filter((result) => result.status === 'not_matched').length,
    };
    const parts = [];
    if (counts.verification)
        parts.push(`${counts.verification} requirement${counts.verification === 1 ? '' : 's'} need${counts.verification === 1 ? 's' : ''} verification`);
    if (counts.documents)
        parts.push(`${counts.documents} required document${counts.documents === 1 ? '' : 's'} missing`);
    if (counts.mismatched)
        parts.push(`${counts.mismatched} requirement${counts.mismatched === 1 ? '' : 's'} not matched`);
    if (parts.length === 0)
        return 'All listed requirements currently match.';
    const total = counts.verification + counts.documents + counts.mismatched;
    return `${total} item${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} attention: ${parts.join('; ')}.`;
}
