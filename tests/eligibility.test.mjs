import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEligibility,
  generateNextActions,
  reconcileApplicationStage,
  calculateApplicationReadiness,
  isDeadlineOpenForApplication,
  validateApplicationStageChange,
} from '../.engine-test-build/engine/eligibility.js';
import { initialState, scholarships } from '../.engine-test-build/data/seed.js';
import {
  getDeadlineInfo,
  getProfileCompleteness,
  rankScholarships,
  sortRecommendationsByDeadline,
} from '../.engine-test-build/engine/recommendations.js';
import { getComparisonHighlights, summarizeRequirementAttention } from '../.engine-test-build/engine/comparison.js';

const scholarship = {
  id: 'sample-scholarship',
  title: 'Sample Education Grant',
  provider: 'Demo Provider',
  amount: 50000,
  deadline: '2099-01-01',
  studyLevel: 'undergraduate',
  category: 'merit',
  description: 'Test fixture only.',
  sourceUrl: 'https://example.org/demo',
  requirements: [
    {
      id: 'minimum-gpa',
      label: 'Minimum GPA of 7.5',
      field: 'gpa',
      operator: 'greater_than_or_equal',
      expectedValue: 7.5,
      failureAction: 'Add your latest GPA to your profile.',
    },
    {
      id: 'transcript',
      label: 'Academic transcript',
      field: 'level',
      operator: 'equals',
      expectedValue: 'undergraduate',
      requiredDocumentId: 'academic-transcript',
    },
  ],
};

const profile = { name: 'Demo Student', email: 'demo@example.org', level: 'undergraduate', gpa: 8.2, category: 'general', state: 'Karnataka' };
const doc = (status) => [{ id: 'academic-transcript', category: 'Academic', label: 'Academic transcript', status, updatedAt: '2098-01-01T00:00:00.000Z' }];
const checklist = [
  { id: 'task-1', task: 'Review requirements', completed: true },
  { id: 'task-2', task: 'Complete form', completed: true },
];
const application = (stage = 'preparing', items = checklist) => ({ scholarshipId: scholarship.id, stage, checklist: items, deadline: scholarship.deadline });

 test('missing profile data is unresolved, not a hard mismatch', () => {
  const result = evaluateEligibility({ ...profile, gpa: undefined }, scholarship, doc('verified'));
  assert.equal(result.results.find((item) => item.requirementId === 'minimum-gpa').status, 'needs_verification');
  assert.equal(result.results.some((item) => item.status === 'not_matched'), false);
  assert.equal(result.canApply, false);
});

test('a value below a mandatory threshold is explicitly not matched', () => {
  const result = evaluateEligibility({ ...profile, gpa: 6.9 }, scholarship, doc('verified'));
  assert.equal(result.results.find((item) => item.requirementId === 'minimum-gpa').status, 'not_matched');
});

test('missing supporting document is document_missing', () => {
  const result = evaluateEligibility(profile, scholarship, doc('missing'));
  const transcript = result.results.find((item) => item.requirementId === 'transcript');
  assert.equal(transcript.status, 'document_missing');
  assert.match(transcript.nextAction, /Prepare academic transcript/i);
});

test('uploaded but unverified document needs verification', () => {
  const result = evaluateEligibility(profile, scholarship, doc('uploaded'));
  const transcript = result.results.find((item) => item.requirementId === 'transcript');
  assert.equal(transcript.status, 'needs_verification');
  assert.match(transcript.explanation, /uploaded but has not been verified/i);
  assert.match(transcript.nextAction, /Verify academic transcript/i);
});

test('verified document satisfies its document requirement', () => {
  const result = evaluateEligibility(profile, scholarship, doc('verified'));
  assert.equal(result.results.find((item) => item.requirementId === 'transcript').status, 'matched');
  assert.equal(result.canApply, true);
});

test('document actions route to the document center using requirement metadata', () => {
  const assessment = evaluateEligibility(profile, scholarship, doc('uploaded'));
  const action = generateNextActions(assessment, scholarship).find((item) => item.id.includes('transcript'));
  assert.equal(action.actionType, 'upload_document');
  assert.match(action.title, /Verify academic transcript/i);
  assert.match(action.description, /uploaded but has not been verified/i);
});

test('missing profile information routes to the profile editor', () => {
  const assessment = evaluateEligibility({ ...profile, gpa: undefined }, scholarship, doc('verified'));
  const action = generateNextActions(assessment, scholarship).find((item) => item.id.includes('minimum-gpa'));
  assert.equal(action.actionType, 'verify_profile');
  assert.match(action.title, /Add your latest GPA/i);
});

test('verified documents do not generate document actions', () => {
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const actions = generateNextActions(assessment, scholarship);
  assert.equal(actions.some((item) => item.id.includes('transcript')), false);
});

test('submitted applications do not show preparation or deadline actions', () => {
  const assessment = evaluateEligibility(profile, scholarship, doc('missing'));
  const actions = generateNextActions(assessment, scholarship, application('applied'));
  assert.deepEqual(actions, []);
});

test('a ready application falls back to preparing when eligibility regresses', () => {
  const readyApplication = application('ready');
  const blockedAssessment = evaluateEligibility(profile, scholarship, doc('missing'));
  const updated = reconcileApplicationStage(readyApplication, blockedAssessment);
  assert.equal(updated.stage, 'preparing');
});

test('a completed checklist and satisfied requirements can move preparation to ready', () => {
  const preparedApplication = application('preparing');
  const satisfiedAssessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const updated = reconcileApplicationStage(preparedApplication, satisfiedAssessment);
  assert.equal(updated.stage, 'ready');
});

test('historical submitted stages are not rewritten by later profile changes', () => {
  const submitted = application('applied');
  const blockedAssessment = evaluateEligibility({ ...profile, gpa: 4 }, scholarship, doc('missing'));
  assert.equal(reconcileApplicationStage(submitted, blockedAssessment).stage, 'applied');
});

test('application readiness is based on checklist progress, not eligibility score', () => {
  const satisfiedAssessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const halfDone = [
    { id: 'task-1', task: 'Review requirements', completed: true },
    { id: 'task-2', task: 'Complete form', completed: false },
  ];
  assert.equal(calculateApplicationReadiness(satisfiedAssessment, halfDone), 50);
});


test('seeded Future Engineers record explains its uploaded transcript honestly', () => {
  const seededScholarship = scholarships.find((item) => item.id === 'future-engineers');
  const assessment = evaluateEligibility(initialState.profile, seededScholarship, initialState.documents);
  const transcript = assessment.results.find((item) => item.requirementId === 'fe-transcript');
  assert.equal(transcript.label, 'Academic transcript');
  assert.equal(transcript.status, 'needs_verification');
  assert.match(transcript.explanation, /uploaded but has not been verified/i);
  const action = generateNextActions(assessment, seededScholarship, initialState.applications.find((item) => item.scholarshipId === seededScholarship.id))
    .find((item) => item.id.includes('fe-transcript'));
  assert.equal(action.actionType, 'upload_document');
  assert.match(action.title, /Verify academic transcript/i);
  assert.match(action.description, /uploaded but has not been verified/i);
});

test('seeded Progress Support record asks for the missing income certificate', () => {
  const seededScholarship = scholarships.find((item) => item.id === 'progress-support');
  const assessment = evaluateEligibility(initialState.profile, seededScholarship, initialState.documents);
  const certificate = assessment.results.find((item) => item.requirementId === 'ps-certificate');
  assert.equal(certificate.label, 'Income certificate');
  assert.equal(certificate.status, 'document_missing');
  const action = generateNextActions(assessment, seededScholarship)
    .find((item) => item.id.includes('ps-certificate'));
  assert.equal(action.actionType, 'upload_document');
  assert.match(action.title, /Prepare income certificate/i);
  assert.doesNotMatch(action.description, /available and verified/i);
});

test('expired opportunities do not create stale preparation tasks', () => {
  const expiredScholarship = { ...scholarship, deadline: '2000-01-01' };
  const assessment = evaluateEligibility(profile, expiredScholarship, doc('missing'));
  assert.deepEqual(generateNextActions(assessment, expiredScholarship), []);
});

test('deadline urgency uses calendar days and marks an 11-day deadline medium', () => {
  const now = new Date(2026, 10, 7, 14, 0, 0);
  assert.deepEqual(getDeadlineInfo('2026-11-18', now), {
    daysUntilDeadline: 11,
    label: '11 days left',
    urgency: 'medium',
  });
  assert.equal(getDeadlineInfo('2026-11-07', now).urgency, 'high');
  assert.equal(getDeadlineInfo('2026-11-06', now).urgency, 'closed');
});

test('profile completeness is a separate profile-quality measure', () => {
  const complete = getProfileCompleteness(initialState.profile);
  assert.equal(complete.score, 100);
  assert.equal(complete.missing.length, 0);
  const incomplete = getProfileCompleteness({ ...initialState.profile, gpa: undefined, familyIncome: undefined });
  assert.equal(incomplete.score, 100);
  assert.deepEqual(incomplete.missing, []);
  assert.deepEqual(incomplete.optionalMissing, ['Academic score', 'Annual family income']);
});

test('recommendations rank strong fits before unresolved and mismatched opportunities', () => {
  const assessments = Object.fromEntries(scholarships.map((item) => [
    item.id,
    evaluateEligibility(initialState.profile, item, initialState.documents),
  ]));
  const ranked = rankScholarships(scholarships, assessments, new Date(2026, 10, 7, 12));
  const labels = ranked.map((item) => item.fitLabel);
  const firstReview = labels.indexOf('Review fit');
  const lastPotential = labels.lastIndexOf('Potential fit');
  assert.ok(firstReview === -1 || lastPotential < firstReview);
  assert.ok(ranked.some((item) => item.fitLabel === 'Strong fit'));
  assert.ok(ranked.every((item) => item.fitScore >= 0 && item.fitScore <= 100));
});

test('recommendation score explains fit and does not claim award probability', () => {
  const assessment = evaluateEligibility(profile, scholarship, doc('uploaded'));
  const item = rankScholarships([scholarship], { [scholarship.id]: assessment }, new Date(2026, 0, 1))[0];
  assert.equal(item.fitLabel, 'Potential fit');
  assert.ok(item.reasons.some((reason) => reason.includes('needs verification')));
  assert.equal(item.fitScore, 75);
});

test('deadline reminders receive medium priority within fourteen days', () => {
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const dueSoon = { ...scholarship, deadline: '2026-11-18' };
  const action = generateNextActions(assessment, dueSoon, undefined, new Date(2026, 10, 7, 14))[0];
  assert.equal(action.priority, 'medium');
  assert.match(action.title, /11 days/);
});

test('deadline urgency boundaries are high through day three and medium through day fourteen', () => {
  const now = new Date(2026, 10, 7, 10);
  assert.equal(getDeadlineInfo('2026-11-10', now).urgency, 'high');
  assert.equal(getDeadlineInfo('2026-11-11', now).urgency, 'medium');
  assert.equal(getDeadlineInfo('2026-11-21', now).urgency, 'medium');
  assert.equal(getDeadlineInfo('2026-11-22', now).urgency, 'low');
});

test('closed scholarships are labelled separately from profile mismatch', () => {
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const [closed] = rankScholarships(
    [{ ...scholarship, deadline: '2026-11-06' }],
    { [scholarship.id]: assessment },
    new Date(2026, 10, 7, 12),
  );
  assert.equal(closed.fitLabel, 'Deadline passed');
  assert.equal(closed.deadline.urgency, 'closed');
});


test('comparison insights identify independent leaders without declaring an overall winner', () => {
  const assessments = Object.fromEntries(scholarships.map((item) => [
    item.id,
    evaluateEligibility(initialState.profile, item, initialState.documents),
  ]));
  const recommendations = rankScholarships(scholarships.slice(0, 3), assessments, new Date(2026, 10, 7, 12));
  const highlights = getComparisonHighlights(recommendations);
  assert.deepEqual(highlights.map((item) => item.id), ['profile-fit', 'award', 'deadline', 'attention']);
  assert.ok(highlights[0].value.includes('/100'));
  assert.ok(highlights[1].value.startsWith('₹'));
  assert.ok(highlights[2].detail.includes('days left'));
  assert.ok(highlights.every((item) => item.scholarshipIds.length > 0));
  const minimumAttention = Math.min(...recommendations.map((item) => item.assessment.results.filter((result) => result.status !== 'matched').length));
  assert.equal(highlights[3].value, `${minimumAttention} item${minimumAttention === 1 ? '' : 's'}`);
  assert.ok(highlights[3].scholarshipIds.length > 0);
});

test('comparison insights represent ties explicitly', () => {
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const tied = [
    { ...rankScholarships([scholarship], { [scholarship.id]: assessment })[0], scholarship: { ...scholarship, id: 'a', title: 'A Grant', amount: 50000 } },
    { ...rankScholarships([scholarship], { [scholarship.id]: assessment })[0], scholarship: { ...scholarship, id: 'b', title: 'B Grant', amount: 50000 } },
  ];
  const highlights = getComparisonHighlights(tied);
  assert.match(highlights.find((item) => item.id === 'profile-fit').value, /^Tie/);
  assert.match(highlights.find((item) => item.id === 'award').value, /^Tie/);
});

test('comparison attention summary uses clear singular and plural wording', () => {
  const oneMissing = evaluateEligibility(profile, scholarship, doc('missing'));
  const [missingRecommendation] = rankScholarships([scholarship], { [scholarship.id]: oneMissing });
  assert.equal(summarizeRequirementAttention(missingRecommendation), '1 item needs attention: 1 required document missing.');

  const complete = evaluateEligibility(profile, scholarship, doc('verified'));
  const [completeRecommendation] = rankScholarships([scholarship], { [scholarship.id]: complete });
  assert.equal(summarizeRequirementAttention(completeRecommendation), 'All listed requirements currently match.');
});

test('deadline sorting keeps open opportunities ahead of expired ones', () => {
  const active = { ...scholarship, id: 'active', deadline: '2099-01-01' };
  const closed = { ...scholarship, id: 'closed', deadline: '2000-01-01' };
  const assessments = {
    active: evaluateEligibility(profile, active, doc('verified')),
    closed: evaluateEligibility(profile, closed, doc('verified')),
  };
  const ranked = rankScholarships([closed, active], assessments, new Date(2026, 10, 7));
  const reversedInput = [...ranked].reverse();
  const sorted = sortRecommendationsByDeadline(reversedInput);
  assert.deepEqual(sorted.map((item) => item.scholarship.id), ['active', 'closed']);
  assert.deepEqual(reversedInput.map((item) => item.scholarship.id), ['closed', 'active']);
});


test('new applications cannot be marked ready or applied after the deadline', () => {
  const expired = application('preparing');
  expired.deadline = '2026-11-06';
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const readyGate = validateApplicationStageChange(expired, 'ready', assessment, new Date(2026, 10, 7));
  const appliedGate = validateApplicationStageChange(expired, 'applied', assessment, new Date(2026, 10, 7));
  assert.equal(readyGate.allowed, false);
  assert.equal(appliedGate.allowed, false);
  assert.match(readyGate.reason, /deadline has passed/i);
});

test('open applications can move to ready only when requirements and checklist are complete', () => {
  const current = application('preparing');
  const completeAssessment = evaluateEligibility(profile, scholarship, doc('verified'));
  assert.deepEqual(validateApplicationStageChange(current, 'ready', completeAssessment, new Date(2026, 10, 7)), {
    allowed: true,
  });
  const incompleteChecklist = application('preparing', [{ id: 'task', task: 'Complete form', completed: false }]);
  const incompleteGate = validateApplicationStageChange(incompleteChecklist, 'applied', completeAssessment, new Date(2026, 10, 7));
  assert.equal(incompleteGate.allowed, false);
  assert.match(incompleteGate.reason, /checklist/i);
});

test('open applications cannot move to ready when eligibility has unresolved requirements', () => {
  const current = application('preparing');
  const blockedAssessment = evaluateEligibility(profile, scholarship, doc('missing'));
  const gate = validateApplicationStageChange(current, 'ready', blockedAssessment, new Date(2026, 10, 7));
  assert.equal(gate.allowed, false);
  assert.match(gate.reason, /eligibility requirements/i);
});

test('expired preparation does not auto-promote to ready when its checklist is completed', () => {
  const expiredPreparation = application('preparing');
  expiredPreparation.deadline = '2026-11-06';
  const satisfiedAssessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const result = reconcileApplicationStage(expiredPreparation, satisfiedAssessment, new Date(2026, 10, 7));
  assert.equal(result.stage, 'preparing');
});

test('a previously ready application retains its historical ready stage after the deadline', () => {
  const previouslyReady = application('ready');
  previouslyReady.deadline = '2026-11-06';
  const satisfiedAssessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const result = reconcileApplicationStage(previouslyReady, satisfiedAssessment, new Date(2026, 10, 7));
  assert.equal(result.stage, 'ready');
});

test('invalid or impossible dates are not treated as open application windows', () => {
  assert.equal(isDeadlineOpenForApplication('not-a-date', new Date(2026, 10, 7)), false);
  assert.equal(isDeadlineOpenForApplication('2026-02-30', new Date(2026, 0, 1)), false);
  assert.equal(isDeadlineOpenForApplication('2026-11-07', new Date(2026, 10, 7)), true);
});


test('an application cannot skip directly from preparation into review or completion', () => {
  const preparing = application('preparing');
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const reviewGate = validateApplicationStageChange(preparing, 'under_review', assessment);
  const completedGate = validateApplicationStageChange(preparing, 'completed', assessment);
  assert.equal(reviewGate.allowed, false);
  assert.match(reviewGate.reason, /mark the application as applied/i);
  assert.equal(completedGate.allowed, false);
  assert.match(completedGate.reason, /only a submitted application/i);
});

test('submitted applications cannot be reopened as preparation', () => {
  const submitted = application('applied');
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  const gate = validateApplicationStageChange(submitted, 'preparing', assessment);
  assert.equal(gate.allowed, false);
  assert.match(gate.reason, /already been submitted/i);
});

test('submitted applications can move to review and completed outcomes', () => {
  const submitted = application('applied');
  const assessment = evaluateEligibility(profile, scholarship, doc('verified'));
  assert.deepEqual(validateApplicationStageChange(submitted, 'under_review', assessment), { allowed: true });
  assert.deepEqual(validateApplicationStageChange(submitted, 'completed', assessment), { allowed: true });
});
