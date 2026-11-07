import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import {
  Activity,
  Award,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  Compass,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { initialState, scholarships } from './data/seed';
import { calculateApplicationReadiness, evaluateEligibility, generateNextActions, isDeadlineOpenForApplication, reconcileApplicationStage, validateApplicationStageChange } from './engine/eligibility';
import { getDeadlineInfo, getProfileCompleteness, rankScholarships, sortRecommendationsByDeadline } from './engine/recommendations';
import { getComparisonHighlights, summarizeRequirementAttention } from './engine/comparison';
import { useLocalStorage } from './hooks/useLocalStorage';
import type {
  ActionItem,
  AppState,
  ApplicationStage,
  DocumentRecord,
  EligibilityAssessment,
  RequirementResult,
  Scholarship,
  StudentProfile,
} from './types';
import type { ScholarshipRecommendation } from './engine/recommendations';

type Page = 'overview' | 'discover' | 'applications' | 'documents' | 'profile';
type CategoryFilter = 'all' | Scholarship['category'];
type LevelFilter = 'all' | 'undergraduate' | 'postgraduate';
type QuickFilter = 'all' | 'requirements-matched' | 'closing-week';

const currency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const getTimeGreeting = (now: Date = new Date()) => {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const categoryLabel: Record<Scholarship['category'], string> = {
  merit: 'Merit-based',
  need_based: 'Need-based',
  diversity: 'Community',
  stem: 'STEM',
};
const stageLabels: Record<ApplicationStage, string> = {
  saved: 'Saved',
  preparing: 'Preparing',
  ready: 'Ready to apply',
  applied: 'Applied',
  under_review: 'Under review',
  completed: 'Completed',
};
const stageOrder: ApplicationStage[] = ['saved', 'preparing', 'ready', 'applied', 'under_review', 'completed'];

function assessmentFor(state: AppState, scholarship: Scholarship): EligibilityAssessment {
  return evaluateEligibility(state.profile, scholarship, state.documents);
}

function StatusBadge({ status }: { status: RequirementResult['status'] }) {
  const config = {
    matched: { label: 'Matched', icon: CheckCircle2, className: 'bg-green-soft text-green-dark' },
    not_matched: { label: 'Not matched', icon: CircleAlert, className: 'bg-red-soft text-red' },
    needs_verification: { label: 'Needs verification', icon: CircleHelp, className: 'bg-amber-soft text-amber' },
    document_missing: { label: 'Document missing', icon: FileText, className: 'bg-slate-100 text-slate-600' },
  }[status];
  const Icon = config.icon;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}><Icon size={12} />{config.label}</span>;
}

function StageBadge({ stage }: { stage: ApplicationStage }) {
  const color = stage === 'ready' || stage === 'completed'
    ? 'bg-green-soft text-green-dark'
    : stage === 'applied' || stage === 'under_review'
      ? 'bg-blue-50 text-blue-700'
      : stage === 'preparing'
        ? 'bg-amber-soft text-amber'
        : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>{stageLabels[stage]}</span>;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

function ProgressBar({ value, tone = 'green' }: { value: number; tone?: 'green' | 'amber' }) {
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-500 ${tone === 'green' ? 'bg-green' : 'bg-amber'}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }: { page: Page; setPage: (page: Page) => void; mobileOpen: boolean; setMobileOpen: (value: boolean) => void }) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const asideRef = useRef<HTMLElement>(null);
  const nav: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'discover', label: 'Discover scholarships', icon: Compass },
    { id: 'applications', label: 'My applications', icon: BriefcaseBusiness },
    { id: 'documents', label: 'Document center', icon: FileCheck2 },
    { id: 'profile', label: 'My profile', icon: UserRound },
  ];

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      setIsDesktop(media.matches);
      if (media.matches) setMobileOpen(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [setMobileOpen]);

  useEffect(() => {
    if (isDesktop || !mobileOpen) return;
    const panel = asideRef.current;
    if (!panel) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.querySelector<HTMLElement>('[data-mobile-menu-first]')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && previousFocus.getClientRects().length > 0) previousFocus.focus();
    };
  }, [isDesktop, mobileOpen, setMobileOpen]);

  const drawerAccessible = isDesktop || mobileOpen;

  return <>
    {mobileOpen && <button aria-hidden="true" tabIndex={-1} aria-label="Close menu overlay" className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside
      id="grantly-primary-navigation"
      ref={asideRef}
      aria-hidden={!drawerAccessible}
      aria-label={!isDesktop ? 'Mobile navigation' : undefined}
      aria-modal={!isDesktop && mobileOpen ? true : undefined}
      role={!isDesktop ? 'dialog' : undefined}
      tabIndex={-1}
      className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line bg-white px-5 py-6 transition-transform duration-200 lg:static lg:z-auto lg:visible lg:translate-x-0 ${mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'}`}
    >
      <div className="flex items-center justify-between px-1">
        <button onClick={() => { setPage('overview'); setMobileOpen(false); }} className="flex items-center gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white"><GraduationCap size={23} /></div>
          <div><div className="font-display text-[20px] font-extrabold tracking-[-.06em] text-ink">GRANTLY<span className="text-green">.</span></div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted">Student workspace</div></div>
        </button>
        <button aria-label="Close navigation" className="rounded-lg p-2 text-muted hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button>
      </div>

      <div className="mt-10">
        <div className="eyebrow px-3">Workspace</div>
        <nav className="mt-3 space-y-1" aria-label="Main navigation">
          {nav.map((item, index) => {
            const Icon = item.icon;
            const active = page === item.id;
            return <button key={item.id} data-mobile-menu-first={index === 0 ? 'true' : undefined} aria-current={active ? 'page' : undefined} onClick={() => { setPage(item.id); setMobileOpen(false); }} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${active ? 'bg-green-soft text-green-dark' : 'text-muted hover:bg-slate-50 hover:text-ink'}`}>
              <Icon size={18} strokeWidth={active ? 2.4 : 1.9} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green" />}
            </button>;
          })}
        </nav>
      </div>

      <div className="mt-9 rounded-2xl bg-[#F3F6F2] p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-green shadow-sm"><Sparkles size={17} /></div>
        <div className="mt-3 text-sm font-bold text-ink">Make your next move count</div>
        <p className="mt-1.5 text-xs leading-5 text-muted">Your profile and documents help GRANTLY explain which requirements need attention.</p>
        <button onClick={() => { setPage('profile'); setMobileOpen(false); }} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-dark hover:gap-2">Review profile <ArrowRight size={13} /></button>
      </div>

      <div className="mt-auto border-t border-line pt-5">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7ECE8] text-sm font-bold text-ink">GS</div>
          <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-ink">GRANTLY Demo</div><div className="text-[11px] text-muted">Local workspace</div></div>
          <Settings2 size={16} className="text-muted" aria-hidden="true" />
        </div>
        <p className="px-2 pt-2 text-[10px] leading-4 text-muted">Demo experience · Data stays in this browser</p>
      </div>
    </aside>
  </>;
}

function Header({ page, profile, onMenu, menuOpen, onProfile }: { page: Page; profile: StudentProfile; onMenu: () => void; menuOpen: boolean; onProfile: () => void }) {
  const labels: Record<Page, { title: string; subtitle: string }> = {
    overview: { title: 'Overview', subtitle: 'A clearer view of your scholarship journey.' },
    discover: { title: 'Discover scholarships', subtitle: 'Find opportunities worth your attention.' },
    applications: { title: 'My applications', subtitle: 'Keep every opportunity moving forward.' },
    documents: { title: 'Document center', subtitle: 'Keep track of the evidence your applications need.' },
    profile: { title: 'My profile', subtitle: 'Your details power more relevant scholarship assessments.' },
  };
  return <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 px-4 py-4 backdrop-blur-xl sm:px-7 lg:px-9">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="grantly-primary-navigation" className="rounded-xl border border-line bg-white p-2.5 text-ink lg:hidden" onClick={onMenu}><Menu size={18} /></button>
        <div className="min-w-0"><h1 className="font-display text-xl font-extrabold tracking-[-.04em] text-ink sm:text-[24px]">{labels[page].title}</h1><p className="mt-0.5 hidden truncate text-xs text-muted sm:block">{labels[page].subtitle}</p></div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-amber-800 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Demo data</div>
        <div className="relative rounded-xl border border-line bg-white p-2.5 text-muted" aria-hidden="true"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-green" /></div>
        <button onClick={onProfile} className="flex items-center gap-2 rounded-xl border border-line bg-white py-1.5 pl-1.5 pr-2.5 hover:bg-slate-50">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-xs font-bold text-white">{profile.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}</span>
          <span className="hidden max-w-[110px] truncate text-xs font-bold text-ink sm:block">{profile.name}</span><ChevronDown size={14} className="text-muted" />
        </button>
      </div>
    </div>
  </header>;
}

function ScholarshipCard({ recommendation, saved, applied, compareSelected, compareDisabled, onOpen, onSave, onApply, onCompare }: {
  recommendation: ScholarshipRecommendation;
  saved: boolean;
  applied: boolean;
  compareSelected: boolean;
  compareDisabled: boolean;
  onOpen: () => void;
  onSave: () => void;
  onApply: () => void;
  onCompare: () => void;
}) {
  const { scholarship, assessment } = recommendation;
  const eligibleCount = assessment.results.filter((item) => item.status === 'matched').length;
  const matchedHighlight = assessment.results.find((item) => item.status === 'matched');
  const attentionHighlight = assessment.results.find((item) => item.status !== 'matched');
  const hardMismatch = assessment.results.some((result) => result.status === 'not_matched');
  const deadlineClosed = recommendation.deadline.urgency === 'closed' || recommendation.deadline.urgency === 'none';
  const fitClass = recommendation.fitLabel === 'Strong fit'
    ? 'bg-green-soft text-green-dark'
    : recommendation.fitLabel === 'Potential fit'
      ? 'bg-amber-soft text-amber'
      : 'bg-red-soft text-red';
  const deadlineClass = recommendation.deadline.urgency === 'high'
    ? 'text-red'
    : recommendation.deadline.urgency === 'medium'
      ? 'text-amber'
      : recommendation.deadline.urgency === 'closed'
        ? 'text-muted'
        : 'text-ink';
  return <article className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
    <div className="flex items-start justify-between gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0F4F0] text-green"><GraduationCap size={21} /></div>
      <button aria-label={saved ? `Remove ${scholarship.title} from saved scholarships` : `Save ${scholarship.title}`} aria-pressed={saved} onClick={onSave} className={`rounded-xl p-2 transition ${saved ? 'bg-green-soft text-green-dark' : 'text-muted hover:bg-slate-100 hover:text-ink'}`}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{categoryLabel[scholarship.category]}</span><span className="text-[10px] font-semibold capitalize text-muted">{scholarship.studyLevel === 'all' ? 'All study levels' : scholarship.studyLevel}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${fitClass}`}>{recommendation.fitLabel}</span></div>
    <h3 className="mt-3 font-display text-[17px] font-extrabold leading-6 tracking-[-.025em] text-ink">{scholarship.title}</h3>
    <p className="mt-1 text-xs text-muted">{scholarship.provider}</p>
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Why this opportunity may fit">
      {matchedHighlight && <span title={matchedHighlight.explanation} className="inline-flex max-w-full items-center gap-1 rounded-full bg-green-soft px-2 py-1 text-[10px] font-semibold text-green-dark"><Check size={11} /><span className="max-w-[190px] truncate">Matches: {matchedHighlight.label}</span></span>}
      {attentionHighlight && <span title={attentionHighlight.explanation} className="inline-flex max-w-full items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800"><CircleHelp size={11} /><span className="max-w-[190px] truncate">{attentionHighlight.status === 'document_missing' ? 'Document needed' : attentionHighlight.status === 'needs_verification' ? 'Needs verification' : 'Review requirement'}: {attentionHighlight.label}</span></span>}
      {!matchedHighlight && !attentionHighlight && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-muted">No listed requirements</span>}
    </div>
    <p className="mt-3 line-clamp-2 min-h-[40px] text-xs leading-5 text-muted">{scholarship.description}</p>
    <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
      <div><div className="eyebrow">Award amount</div><div className="mt-1 font-display text-xl font-extrabold tracking-[-.04em] text-ink">{currency(scholarship.amount)}</div></div>
      <div className="text-right"><div className="eyebrow">Deadline</div><div className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${deadlineClass}`}><CalendarDays size={13} className="text-muted" />{shortDate(scholarship.deadline)}</div><div className={`mt-0.5 text-[10px] font-semibold ${deadlineClass}`}>{recommendation.deadline.label}</div></div>
    </div>
    <div className="mt-4 rounded-xl bg-[#F7F8F5] p-3">
      <div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink" title="Profile-fit index: a requirement-alignment measure based on matched, unresolved, and mismatched criteria. It is not an eligibility decision or award probability.">Profile fit <CircleHelp size={12} className="text-muted" aria-hidden="true" /></span><span className="text-[11px] font-extrabold text-ink">{recommendation.fitScore}/100</span></div>
      <div className="mt-2 flex items-center gap-2"><ProgressBar value={recommendation.fitScore} tone={hardMismatch ? 'amber' : 'green'} /><span className="w-10 text-right text-[10px] font-bold tabular-nums text-ink">{eligibleCount}/{assessment.results.length}</span></div>
      <div className="mt-1.5 text-[10px] leading-4 text-muted">{recommendation.reasons[0]}. A fit index, not an eligibility decision or award probability.</div>
    </div>
    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
      <button onClick={onOpen} className="btn-secondary min-w-0 flex-1 px-3">View details <ArrowUpRight size={14} /></button>
      <button onClick={onApply} disabled={applied || deadlineClosed} title={deadlineClosed ? 'This opportunity is closed or has no valid deadline.' : undefined} className="btn-primary px-3">{applied ? <><Check size={14} /> Added</> : deadlineClosed ? 'Closed' : <><Plus size={14} /> Track</>}</button>
    </div>
    <button onClick={onCompare} aria-pressed={compareSelected} aria-label={`${compareSelected ? 'Remove' : 'Add'} ${scholarship.title} ${compareSelected ? 'from' : 'to'} comparison`} disabled={!compareSelected && compareDisabled} className={`mt-2 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${compareSelected ? 'bg-green-soft text-green-dark' : 'text-muted hover:bg-slate-50 hover:text-ink'} disabled:cursor-not-allowed disabled:opacity-40`}>
      {compareSelected ? <Check size={13} /> : <Activity size={13} />}{compareSelected ? 'Added to comparison' : 'Compare opportunity'}
    </button>
  </article>;
}
function RequirementRow({ result }: { result: RequirementResult }) {
  return <div className="flex items-start gap-3 border-b border-line py-3 last:border-0">
    <div className="mt-0.5 flex-1"><div className="text-sm font-semibold text-ink">{result.label}</div><p className="mt-1 text-xs leading-5 text-muted">{result.explanation}</p>{result.nextAction && result.status !== 'matched' && <p className="mt-1.5 text-xs font-semibold text-green-dark">Next: {result.nextAction}</p>}</div>
    <StatusBadge status={result.status} />
  </div>;
}

function useDialogAccessibility(dialogRef: RefObject<HTMLElement>, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const preferredFocus = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
    (preferredFocus ?? dialog).focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [dialogRef]);
}

function ScholarshipModal({ scholarship, assessment, saved, applied, onClose, onSave, onApply }: {
  scholarship: Scholarship;
  assessment: EligibilityAssessment;
  saved: boolean;
  applied: boolean;
  onClose: () => void;
  onSave: () => void;
  onApply: () => void;
}) {
  const hardMismatch = assessment.results.some((result) => result.status === 'not_matched');
  const deadlineClosed = !isDeadlineOpenForApplication(scholarship.deadline);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogAccessibility(dialogRef, onClose);
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="scholarship-modal-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-white shadow-lift sm:rounded-[28px]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><div className="flex items-center gap-2 text-xs font-bold text-muted"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-soft text-green-dark"><GraduationCap size={17} /></span> Scholarship overview</div><button data-dialog-initial-focus aria-label="Close scholarship details" onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-slate-100"><X size={19} /></button></div>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-xl"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{categoryLabel[scholarship.category]}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">Fictional demo opportunity</span></div><h2 id="scholarship-modal-title" className="mt-3 font-display text-2xl font-extrabold tracking-[-.04em] text-ink sm:text-3xl">{scholarship.title}</h2><p className="mt-1 text-sm text-muted">{scholarship.provider}</p></div><div className="rounded-2xl bg-[#F3F6F2] px-4 py-3"><div className="eyebrow">Award amount</div><div className="mt-1 font-display text-2xl font-extrabold text-ink">{currency(scholarship.amount)}</div></div></div>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-muted">{scholarship.description}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-line p-3"><div className="eyebrow">Application deadline</div><div className="mt-1 flex items-center gap-2 text-sm font-bold text-ink"><CalendarDays size={15} className="text-muted" />{dateLabel(scholarship.deadline)}</div></div><div className="rounded-xl border border-line p-3"><div className="eyebrow">Study level</div><div className="mt-1 text-sm font-bold capitalize text-ink">{scholarship.studyLevel === 'all' ? 'All levels' : scholarship.studyLevel}</div></div><div className="rounded-xl border border-line p-3"><div className="eyebrow">Requirements matched</div><div className="mt-1 text-sm font-bold text-ink">{assessment.results.filter((result) => result.status === 'matched').length} of {assessment.results.length}</div><p className="text-[10px] text-muted">Not a probability of receiving an award</p></div></div>
        <div className="mt-7"><div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-display text-lg font-extrabold text-ink">Your requirement assessment</h3><p className="mt-1 text-xs text-muted">Based on the information and document statuses in your profile.</p></div><span className={`text-xs font-bold ${hardMismatch ? 'text-red' : assessment.canApply ? 'text-green-dark' : 'text-amber'}`}>{hardMismatch ? 'One or more conditions do not match' : assessment.canApply ? 'All listed requirements matched' : 'Some details need attention'}</span></div><div className="mt-3 rounded-2xl border border-line px-4">{assessment.results.map((result) => <RequirementRow key={result.requirementId} result={result} />)}</div></div>
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900"><ShieldCheck size={17} className="shrink-0" /><span>This is a readiness assessment based on supplied demo information. The awarding organisation makes the final eligibility and funding decision.</span></div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button onClick={onSave} className="btn-secondary">{saved ? <Check size={15} /> : <Bookmark size={15} />}{saved ? 'Saved to shortlist' : 'Save scholarship'}</button><button onClick={onApply} disabled={applied || deadlineClosed} title={deadlineClosed ? 'This opportunity is closed or has no valid deadline.' : undefined} className="btn-primary">{applied ? 'Already in applications' : deadlineClosed ? 'Deadline has passed' : 'Add to my applications'} <ArrowRight size={15} /></button></div>
        <p className="mt-4 text-[10px] leading-4 text-muted">Sample source reference: <a className="font-semibold text-green-dark underline underline-offset-2" href={scholarship.sourceUrl} target="_blank" rel="noreferrer">example.org demo record</a>. This is not an official scholarship listing.</p>
      </div>
    </section>
  </div>;
}


function TodayPanel({ actions, recommendations, onOpenAction, onNavigate }: {
  actions: ActionItem[];
  recommendations: ScholarshipRecommendation[];
  onOpenAction: (action: ActionItem) => void;
  onNavigate: (page: Page) => void;
}) {
  const primary = actions[0];
  const secondary = actions.slice(1, 3);
  const related = primary?.scholarshipId
    ? recommendations.find((item) => item.scholarship.id === primary.scholarshipId)
    : undefined;
  const PrimaryIcon = primary?.actionType === 'upload_document'
    ? Upload
    : primary?.actionType === 'review_deadline'
      ? Clock3
      : UserRound;

  return <Card className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5 sm:px-6">
      <div>
        <div className="eyebrow">Today · your action center</div>
        <h3 className="mt-1 font-display text-lg font-extrabold tracking-[-.03em] text-ink">What should I do next?</h3>
        <p className="mt-1 text-xs text-muted">A focused next step, based on your profile, documents and deadlines.</p>
      </div>
      {actions.length > 0 && <span className="rounded-full bg-green-soft px-2.5 py-1 text-[10px] font-bold text-green-dark">{actions.length} suggested action{actions.length === 1 ? '' : 's'}</span>}
    </div>
    {primary ? <>
      <div className="bg-[#F0F5F0] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-green-dark"><Sparkles size={11} /> Recommended next step</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] ${primary.priority === 'high' ? 'bg-red-soft text-red' : primary.priority === 'medium' ? 'bg-amber-soft text-amber' : 'bg-white text-muted'}`}>{primary.priority} priority</span>
        </div>
        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-green-dark shadow-sm"><PrimaryIcon size={20} /></div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-lg font-extrabold leading-6 tracking-[-.025em] text-ink">{primary.title}</h4>
            <p className="mt-1 text-xs leading-5 text-muted">{primary.description}</p>
            {related && <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-ink"><CalendarDays size={12} className="text-muted" /> {related.scholarship.title} · {related.deadline.label}</p>}
            <button onClick={() => onOpenAction(primary)} className="btn-primary mt-4 px-3 py-2 text-xs">Take this step <ArrowRight size={13} /></button>
          </div>
        </div>
      </div>
      {secondary.length > 0 && <div className="divide-y divide-line">
        {secondary.map((action) => <button key={action.id} onClick={() => onOpenAction(action)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-muted">{action.actionType === 'upload_document' ? <Upload size={14} /> : action.actionType === 'review_deadline' ? <Clock3 size={14} /> : <UserRound size={14} />}</span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-ink">{action.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted">{action.description}</span></span>
          <ChevronRight size={15} className="shrink-0 text-muted" />
        </button>)}
      </div>}
    </> : <div className="px-6 py-9 text-center">
      <CircleCheck className="mx-auto text-green" size={27} />
      <p className="mt-2 text-sm font-bold text-ink">You're up to date</p>
      <p className="mt-1 text-xs text-muted">No immediate actions were generated from your current profile and applications.</p>
      <button onClick={() => onNavigate('discover')} className="btn-secondary mt-4">Explore opportunities <ArrowRight size={13} /></button>
    </div>}
    {actions.length > 3 && <div className="border-t border-line px-5 py-3 sm:px-6"><button onClick={() => onNavigate('applications')} className="text-xs font-bold text-green-dark hover:underline">View application workspace <ArrowRight size={13} className="ml-1 inline" /></button></div>}
  </Card>;
}

function Dashboard({ state, recommendations, actions, onNavigate, onOpen, onOpenAction }: {
  state: AppState;
  recommendations: ScholarshipRecommendation[];
  actions: ActionItem[];
  onNavigate: (page: Page) => void;
  onOpen: (scholarship: Scholarship) => void;
  onOpenAction: (action: ActionItem) => void;
}) {
  const tracked = state.applications.filter((application) => application.stage !== 'completed').length;
  const upcoming = state.applications.filter((application) => application.stage !== 'completed' && (getDeadlineInfo(application.deadline).daysUntilDeadline ?? -1) >= 0).length;
  const potentialMatches = recommendations.filter((item) => item.fitLabel === 'Strong fit' || item.fitLabel === 'Potential fit').length;
  const recommended = recommendations.filter((item) => item.deadline.urgency !== 'closed').slice(0, 3);
  const profileCompleteness = getProfileCompleteness(state.profile);
  const name = state.profile.name.trim().split(' ')[0] || 'there';
  return <div className="space-y-7">
    <section className="relative overflow-hidden rounded-[26px] bg-ink px-6 py-7 text-white shadow-soft sm:px-8 sm:py-8">
      <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10" /><div className="absolute -right-2 -top-10 h-48 w-48 rounded-full border border-white/10" /><div className="absolute -bottom-24 right-40 h-40 w-40 rounded-full bg-green/20 blur-3xl" />
      <div className="relative max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#B9DCCB]"><Sparkles size={13} /> Your scholarship workspace</div><h2 className="mt-4 font-display text-[27px] font-extrabold leading-tight tracking-[-.05em] sm:text-[36px]">{getTimeGreeting()}, {name}.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">The next step is easier when you know what matters. Explore relevant opportunities, resolve requirements, and keep your applications moving.</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => onNavigate('discover')} className="inline-flex items-center gap-2 rounded-xl bg-[#BDE2CC] px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-white">Explore scholarships <ArrowRight size={14} /></button><button onClick={() => onNavigate('applications')} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10">View applications</button></div></div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Compass} label="Potential matches" value={String(potentialMatches).padStart(2, '0')} note="No confirmed requirement mismatch" tone="green" />
      <Metric icon={BriefcaseBusiness} label="Active applications" value={String(tracked).padStart(2, '0')} note="Tracked opportunities in progress" tone="navy" />
      <Metric icon={CalendarDays} label="Upcoming deadlines" value={String(upcoming).padStart(2, '0')} note="Tracked applications not yet closed" tone="amber" />
      <Metric icon={FileCheck2} label="Documents verified" value={`${state.documents.filter((doc) => doc.status === 'verified').length}/${state.documents.length}`} note="Metadata only · No files stored" tone="green" />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5 sm:px-6"><div><div className="eyebrow">Ranked by your profile</div><h3 className="mt-1 font-display text-lg font-extrabold tracking-[-.03em] text-ink">Recommended for you</h3><p className="mt-1 text-[11px] text-muted">Transparent requirement fit · not award probability</p></div><button onClick={() => onNavigate('discover')} className="btn-ghost px-2">View all <ArrowRight size={14} /></button></div>
        <div className="divide-y divide-line">{recommended.map((item) => <button key={item.scholarship.id} onClick={() => onOpen(item.scholarship)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F0F4F0] text-green"><GraduationCap size={20} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-ink">{item.scholarship.title}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted"><span>{currency(item.scholarship.amount)}</span><span>·</span><span>Due {shortDate(item.scholarship.deadline)}</span><span>·</span><span className={item.fitLabel === 'Strong fit' ? 'font-bold text-green-dark' : 'font-bold text-amber'}>{item.fitLabel}</span></div></div><div className="hidden min-w-[110px] sm:block"><div className="mb-1 flex justify-between text-[10px] font-bold"><span className="text-muted">Profile fit</span><span className="text-ink">{item.fitScore}</span></div><ProgressBar value={item.fitScore} tone={item.fitLabel === 'Review fit' ? 'amber' : 'green'} /></div><ChevronRight size={17} className="shrink-0 text-muted" /></button>)}</div>
        {recommended.length === 0 && <div className="px-6 py-8 text-center text-sm text-muted">No open opportunities in the current demo catalogue.</div>}
      </Card>

      <TodayPanel actions={actions} recommendations={recommendations} onOpenAction={onOpenAction} onNavigate={onNavigate} />
    </div>

    <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
      <Card className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="eyebrow">Your progress</div><h3 className="mt-1 font-display text-lg font-extrabold text-ink">Application pipeline</h3></div><button onClick={() => onNavigate('applications')} className="btn-ghost px-2">Manage <ArrowRight size={14} /></button></div><div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">{stageOrder.map((stage) => <div key={stage} className="min-w-0 rounded-xl bg-[#F7F8F5] px-2 py-3 text-center"><div className="font-display text-xl font-extrabold text-ink">{state.applications.filter((application) => application.stage === stage).length}</div><div className="mt-1 truncate text-[9px] font-semibold text-muted">{stageLabels[stage]}</div></div>)}</div></Card>
      <Card className="p-5 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-soft text-green-dark"><Target size={22} /></div><div className="min-w-0 flex-1"><div className="eyebrow">Profile quality</div><div className="mt-1 flex items-baseline justify-between gap-2"><h3 className="text-sm font-bold text-ink">Core profile completeness</h3><span className="text-sm font-extrabold text-green-dark">{profileCompleteness.score}%</span></div><div className="mt-2"><ProgressBar value={profileCompleteness.score} /></div><p className="mt-2 text-[11px] leading-4 text-muted">{profileCompleteness.missing.length > 0 ? `Core details still needed: ${profileCompleteness.missing.join(', ')}.` : profileCompleteness.optionalMissing.length > 0 ? `Core details are complete. Optional details that can improve matching: ${profileCompleteness.optionalMissing.join(', ')}.` : 'Your core and optional profile details are complete.'}</p></div><button onClick={() => onNavigate('profile')} className="btn-secondary shrink-0 px-3">Review <ArrowRight size={13} /></button></div></Card>
    </div>
    <DemoNotice />
  </div>;
}
function Metric({ icon: Icon, label, value, note, tone }: { icon: typeof Compass; label: string; value: string; note: string; tone: 'green' | 'navy' | 'amber' }) {
  const iconClass = tone === 'green' ? 'bg-green-soft text-green-dark' : tone === 'amber' ? 'bg-amber-soft text-amber' : 'bg-slate-100 text-ink';
  return <Card className="p-4 sm:p-5"><div className="flex items-center justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}><Icon size={17} /></div><MoreHorizontal size={17} className="text-slate-300" /></div><div className="mt-4 font-display text-[28px] font-extrabold tracking-[-.05em] text-ink">{value}</div><div className="mt-0.5 text-xs font-bold text-ink">{label}</div><p className="mt-1 text-[10px] leading-4 text-muted">{note}</p></Card>;
}

function Discovery({ state, recommendations, onOpen, onSave, onApply }: {
  state: AppState;
  recommendations: ScholarshipRecommendation[];
  onOpen: (scholarship: Scholarship) => void;
  onSave: (id: string) => void;
  onApply: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [sort, setSort] = useState<'recommended' | 'deadline' | 'amount'>('recommended');
  const [savedOnly, setSavedOnly] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = recommendations.filter((recommendation) => {
      const { scholarship, assessment, deadline } = recommendation;
      const matchesQuery = !q || `${scholarship.title} ${scholarship.provider} ${scholarship.description}`.toLowerCase().includes(q);
      const matchesCategory = category === 'all' || scholarship.category === category;
      const matchesLevel = level === 'all' || scholarship.studyLevel === 'all' || scholarship.studyLevel === level;
      const matchesSaved = !savedOnly || state.savedScholarshipIds.includes(scholarship.id);
      const matchesQuickFilter = quickFilter === 'all'
        || (quickFilter === 'requirements-matched' && assessment.canApply && deadline.daysUntilDeadline !== null && deadline.daysUntilDeadline >= 0)
        || (quickFilter === 'closing-week' && deadline.daysUntilDeadline !== null && deadline.daysUntilDeadline >= 0 && deadline.daysUntilDeadline <= 7);
      return matchesQuery && matchesCategory && matchesLevel && matchesSaved && matchesQuickFilter;
    });
    if (sort === 'deadline') return sortRecommendationsByDeadline(list);
    if (sort === 'amount') list.sort((a, b) => b.scholarship.amount - a.scholarship.amount);
    return list;
  }, [recommendations, query, category, level, sort, savedOnly, quickFilter, state.savedScholarshipIds]);

  const comparisonItems = compareIds
    .map((id) => recommendations.find((item) => item.scholarship.id === id))
    .filter((item): item is ScholarshipRecommendation => Boolean(item));

  const toggleCompare = (id: string) => {
    setCompareIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 3 ? [...current, id] : current);
  };

  return <div className="space-y-6">
    <section className="rounded-[24px] bg-[#EAF0E9] px-5 py-6 sm:px-7"><div className="flex flex-wrap items-end justify-between gap-4"><div className="max-w-xl"><div className="eyebrow text-green-dark">Opportunity discovery</div><h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em] text-ink sm:text-[30px]">Find an opportunity that fits your next chapter.</h2><p className="mt-2 text-sm leading-6 text-muted">Recommendations are ranked from your actual requirement results. Compare up to three opportunities before deciding what to track.</p></div><div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3"><div className="font-display text-2xl font-extrabold text-ink">{scholarships.length}</div><div className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Demo opportunities</div></div></div></section>
    <Card className="p-4 sm:p-5"><div role="search" aria-label="Filter scholarship opportunities" className="grid gap-3 lg:grid-cols-[1fr_190px_190px_175px]"><label className="relative block"><span className="sr-only">Search scholarships</span><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scholarships, providers, keywords..." /></label><label><span className="sr-only">Filter by category</span><select className="field" value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}><option value="all">All categories</option><option value="merit">Merit-based</option><option value="need_based">Need-based</option><option value="stem">STEM</option><option value="diversity">Community</option></select></label><label><span className="sr-only">Filter by study level</span><select className="field" value={level} onChange={(event) => setLevel(event.target.value as LevelFilter)}><option value="all">All study levels</option><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option></select></label><label><span className="sr-only">Sort scholarships</span><select className="field" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recommended">Best profile fit</option><option value="deadline">Soonest deadline</option><option value="amount">Highest award</option></select></label></div>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Quick scholarship filters">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[.1em] text-muted">Quick filters</span>
        <button onClick={() => setQuickFilter('all')} aria-pressed={quickFilter === 'all'} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${quickFilter === 'all' ? 'border-green bg-green-soft text-green-dark' : 'border-line bg-white text-muted hover:bg-slate-50'}`}>All opportunities</button>
        <button onClick={() => setQuickFilter('requirements-matched')} aria-pressed={quickFilter === 'requirements-matched'} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${quickFilter === 'requirements-matched' ? 'border-green bg-green-soft text-green-dark' : 'border-line bg-white text-muted hover:bg-slate-50'}`}>All requirements matched</button>
        <button onClick={() => setQuickFilter('closing-week')} aria-pressed={quickFilter === 'closing-week'} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${quickFilter === 'closing-week' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-line bg-white text-muted hover:bg-slate-50'}`}>Closing this week</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted"><div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1.5"><Filter size={13} /> {filtered.length} opportunities shown</span><button onClick={() => setSavedOnly((current) => !current)} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold ${savedOnly ? 'bg-green-soft text-green-dark' : 'text-muted hover:bg-slate-100'}`}><Bookmark size={12} fill={savedOnly ? 'currentColor' : 'none'} /> Saved only</button></div><div className="flex flex-wrap items-center gap-2"><button disabled={compareIds.length < 2} onClick={() => setCompareOpen(true)} aria-label={`Compare selected opportunities, ${compareIds.length} of 3 selected`} className="btn-primary px-3 py-2 text-xs disabled:opacity-40">Compare ({compareIds.length}/3)</button>{compareIds.length > 0 && <button onClick={() => setCompareIds([])} className="font-bold text-muted hover:text-ink">Clear comparison</button>}<button onClick={() => { setQuery(''); setCategory('all'); setLevel('all'); setSort('recommended'); setSavedOnly(false); setQuickFilter('all'); }} className="font-bold text-green-dark hover:underline">Reset filters</button></div></div>
      {compareIds.length === 1 && <p className="mt-2 text-[10px] text-muted">Select one more opportunity to compare side by side. You can compare up to three.</p>}
    </Card>
    {filtered.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((recommendation) => <ScholarshipCard key={recommendation.scholarship.id} recommendation={recommendation} saved={state.savedScholarshipIds.includes(recommendation.scholarship.id)} applied={state.applications.some((application) => application.scholarshipId === recommendation.scholarship.id)} compareSelected={compareIds.includes(recommendation.scholarship.id)} compareDisabled={compareIds.length >= 3} onOpen={() => onOpen(recommendation.scholarship)} onSave={() => onSave(recommendation.scholarship.id)} onApply={() => onApply(recommendation.scholarship.id)} onCompare={() => toggleCompare(recommendation.scholarship.id)} />)}</div> : <Card className="px-6 py-14 text-center"><Search className="mx-auto text-slate-300" size={30} /><h3 className="mt-3 font-display text-lg font-extrabold text-ink">No scholarships found</h3><p className="mt-1 text-sm text-muted">Try changing your search or filters.</p><button className="btn-secondary mt-4" onClick={() => { setQuery(''); setCategory('all'); setLevel('all'); setSort('recommended'); setSavedOnly(false); setQuickFilter('all'); }}>Clear filters</button></Card>}
    <DemoNotice />
    {compareOpen && comparisonItems.length >= 2 && <ComparisonModal items={comparisonItems} onClose={() => setCompareOpen(false)} onRemove={(id) => { toggleCompare(id); if (comparisonItems.length <= 2) setCompareOpen(false); }} onOpen={(scholarship) => { setCompareOpen(false); onOpen(scholarship); }} />}
  </div>;
}

function ComparisonModal({ items, onClose, onRemove, onOpen }: {
  items: ScholarshipRecommendation[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onOpen: (scholarship: Scholarship) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogAccessibility(dialogRef, onClose);
  const highlights = getComparisonHighlights(items);
  const summaryRows: Array<{ label: string; value: (item: ScholarshipRecommendation) => ReactNode }> = [
    { label: 'Provider', value: (item) => item.scholarship.provider },
    { label: 'Award amount', value: (item) => <strong>{currency(item.scholarship.amount)}</strong> },
    { label: 'Deadline', value: (item) => <span className={item.deadline.urgency === 'high' ? 'font-bold text-red' : item.deadline.urgency === 'medium' ? 'font-bold text-amber' : 'font-semibold text-ink'}>{dateLabel(item.scholarship.deadline)} · {item.deadline.label}</span> },
    { label: 'Study level', value: (item) => item.scholarship.studyLevel === 'all' ? 'All levels' : item.scholarship.studyLevel },
    { label: 'Category', value: (item) => categoryLabel[item.scholarship.category] },
    { label: 'Profile fit', value: (item) => <span title="Profile-fit index: a requirement-alignment measure based on matched, unresolved, and mismatched criteria. It is not an eligibility decision or award probability." className="inline-flex items-center gap-1 font-bold text-green-dark" aria-label={`Profile fit ${item.fitScore} out of 100. This is not an award probability.`}>{item.fitScore}/100 · {item.fitLabel}<CircleHelp size={13} aria-hidden="true" /></span> },
    { label: 'Matched requirements', value: (item) => `${item.assessment.results.filter((result) => result.status === 'matched').length} / ${item.assessment.results.length}` },
    { label: 'Needs verification', value: (item) => item.assessment.results.filter((result) => result.status === 'needs_verification').length },
    { label: 'Documents missing', value: (item) => item.assessment.results.filter((result) => result.status === 'document_missing').length },
    { label: 'Not matched', value: (item) => item.assessment.results.filter((result) => result.status === 'not_matched').length },
  ];
  const requirementLabels = Array.from(new Set(items.flatMap((item) => item.assessment.results.map((result) => result.label))));
  const requirementRows = requirementLabels.map((label) => ({
    label: `Requirement · ${label}`,
    value: (item: ScholarshipRecommendation): ReactNode => {
      const result = item.assessment.results.find((entry) => entry.label === label);
      return result
        ? <div className="flex flex-col items-start gap-1"><StatusBadge status={result.status} /><span className="text-[10px] leading-4 text-muted">{result.explanation}</span></div>
        : <span className="text-xs text-muted">Not part of this opportunity&apos;s listed criteria.</span>;
    },
  }));
  const rows = [...summaryRows, ...requirementRows, {
    label: 'Requirements needing attention',
    value: (item: ScholarshipRecommendation) => <span className="text-xs leading-5 text-muted">{summarizeRequirementAttention(item)}</span>,
  }];
  const toneClasses = {
    green: 'border-green/20 bg-green-soft text-green-dark',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-line bg-[#F7F8F5] text-ink',
  };
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="comparison-title" className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-t-[26px] bg-white shadow-lift sm:rounded-[26px]">
      <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7"><div><div className="eyebrow">Side-by-side review</div><h2 id="comparison-title" className="mt-1 font-display text-xl font-extrabold text-ink">Compare opportunities</h2><p className="mt-1 text-xs text-muted">Compare benefits, timing and your current requirement assessment.</p></div><button data-dialog-initial-focus aria-label="Close comparison" onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-slate-100"><X size={19} /></button></div>
      <div className="max-h-[calc(92vh-82px)] overflow-auto p-4 sm:p-6">
        <section aria-label="Comparison insights" className="mb-5">
          <div className="mb-3"><div className="eyebrow">Decision support</div><h3 className="mt-1 text-sm font-extrabold text-ink">Highlights across your selected opportunities</h3></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {highlights.map((highlight) => {
              const HighlightIcon = highlight.id === 'profile-fit' ? Target : highlight.id === 'award' ? Award : highlight.id === 'deadline' ? CalendarDays : CircleAlert;
              return <div key={highlight.id} className={`min-w-0 rounded-xl border p-3 ${toneClasses[highlight.tone]}`}>
                <div className="flex items-center gap-2"><HighlightIcon size={14} aria-hidden="true" /><div className="text-[10px] font-extrabold uppercase tracking-[.1em] opacity-80">{highlight.label}</div></div>
                <div className="mt-2 break-words font-display text-lg font-extrabold">{highlight.value}</div>
                <p className="mt-1 text-[10px] leading-4 opacity-80">{highlight.detail}</p>
              </div>;
            })}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-muted">These highlights compare individual criteria; they do not declare one overall winner. Choose based on your priorities and verify the provider&apos;s official terms.</p>
        </section>
        <div className="mb-2 flex items-center gap-2 text-[10px] text-muted sm:hidden"><Activity size={13} /> Swipe horizontally to compare all selected opportunities.</div>
        <div className="overflow-x-auto rounded-xl" role="region" aria-label="Side-by-side scholarship comparison table" tabIndex={0}>
          <div className="min-w-[700px]"><div className="grid gap-3" style={{ gridTemplateColumns: `150px repeat(${items.length}, minmax(190px, 1fr))` }}>
            <div className="rounded-xl bg-[#F7F8F5] p-3"><div className="eyebrow">Comparison</div><div className="mt-2 text-sm font-bold text-ink">Key criteria</div></div>
            {items.map((item) => <div key={item.scholarship.id} className="rounded-xl border border-line p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="break-words text-sm font-extrabold leading-5 text-ink">{item.scholarship.title}</div><div className="mt-1 text-[10px] text-muted">{item.scholarship.provider}</div></div><button aria-label={`Remove ${item.scholarship.title} from comparison`} onClick={() => onRemove(item.scholarship.id)} className="shrink-0 rounded-lg p-1 text-muted hover:bg-slate-100"><X size={14} /></button></div><button onClick={() => onOpen(item.scholarship)} className="mt-3 text-xs font-bold text-green-dark hover:underline">View full assessment <ArrowRight size={12} className="inline" /></button></div>)}
            {rows.map((row) => <Fragment key={row.label}><div className="flex items-center rounded-lg bg-[#F7F8F5] px-3 py-3 text-xs font-bold text-ink">{row.label}</div>{items.map((item) => <div key={`${item.scholarship.id}-${row.label}`} className="flex min-h-12 min-w-0 items-center rounded-lg border border-line px-3 py-3 text-sm text-ink">{row.value(item)}</div>)}</Fragment>)}
          </div></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><p className="text-[10px] leading-4 text-muted">Profile fit is a deterministic index based on requirement states. It is not an award probability or guarantee.</p><button onClick={onClose} className="btn-primary">Done comparing</button></div>
      </div>
    </section>
  </div>;
}

function ApplicationsPage({ state, assessments, onOpen, onStageChange, onChecklistToggle, onDiscover }: {
  state: AppState;
  assessments: Record<string, EligibilityAssessment>;
  onOpen: (scholarship: Scholarship) => void;
  onStageChange: (scholarshipId: string, stage: ApplicationStage) => void;
  onChecklistToggle: (scholarshipId: string, checklistId: string) => void;
  onDiscover: () => void;
}) {
  if (!state.applications.length) return <EmptyState icon={BriefcaseBusiness} title="Your application workspace is ready" description="Add a scholarship to start tracking its requirements, documents, and progress in one place." cta="Explore scholarships" onClick={onDiscover} />;
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow">Your pipeline</div><h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-.04em] text-ink">Keep every application moving.</h2><p className="mt-1 text-sm text-muted">Update stages and complete preparation tasks as you go.</p></div><button onClick={onDiscover} className="btn-primary"><Plus size={15} /> Add opportunity</button></div>
    <div className="grid gap-4 xl:grid-cols-2">{state.applications.map((application) => {
      const scholarship = scholarships.find((item) => item.id === application.scholarshipId);
      if (!scholarship) return null;
      const assessment = assessments[scholarship.id];
      const readiness = calculateApplicationReadiness(assessment, application.checklist);
      const completedCount = application.checklist.filter((item) => item.completed).length;
      return <Card key={application.scholarshipId} className="overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5"><div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F4F0] text-green"><GraduationCap size={19} /></div><div className="min-w-0"><button onClick={() => onOpen(scholarship)} className="text-left font-display text-base font-extrabold leading-5 text-ink hover:text-green-dark">{scholarship.title}</button><div className="mt-1 text-xs text-muted">{scholarship.provider}</div></div></div><StageBadge stage={application.stage} /></div>
        <div className="grid grid-cols-2 gap-3 px-5 py-4"><div><div className="eyebrow">Award</div><div className="mt-1 text-sm font-extrabold text-ink">{currency(scholarship.amount)}</div></div><div><div className="eyebrow">Deadline</div><div className="mt-1 text-sm font-extrabold text-ink">{dateLabel(application.deadline)}</div></div></div>
        <div className="px-5 pb-4"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-ink">Application readiness</span><span className="text-xs font-extrabold text-green-dark">{readiness}%</span></div><ProgressBar value={readiness} /><div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted"><span>{completedCount} of {application.checklist.length} preparation tasks completed</span><span className={assessment.canApply ? 'font-bold text-green-dark' : 'font-bold text-amber'}>Eligibility: {assessment.results.filter((result) => result.status === 'matched').length}/{assessment.results.length} matched</span></div></div>
        <div className="mx-5 mb-4 rounded-xl border border-line bg-[#FAFBF9] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-extrabold text-ink">Eligibility blockers</h4><span className={`text-[10px] font-bold ${assessment.blockers.length ? 'text-amber' : 'text-green-dark'}`}>{assessment.blockers.length ? `${assessment.blockers.length} need attention` : 'No unresolved requirements'}</span></div>{assessment.blockers.length ? <div className="mt-2 space-y-2">{assessment.blockers.slice(0, 2).map((blocker) => <div key={blocker.requirementId} className="flex items-start justify-between gap-3 text-[11px]"><div className="min-w-0"><div className="font-semibold text-ink">{blocker.label}</div><p className="mt-0.5 leading-4 text-muted">{blocker.nextAction ?? blocker.explanation}</p></div><StatusBadge status={blocker.status} /></div>)}{assessment.blockers.length > 2 && <p className="text-[10px] font-semibold text-muted">+{assessment.blockers.length - 2} more requirement blockers</p>}</div> : <p className="mt-1 text-[11px] leading-4 text-muted">All listed scholarship requirements currently match your profile and document records.</p>}</div>
        <div className="border-t border-line px-5 py-4"><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-extrabold text-ink">Preparation checklist</h4><span className="text-[10px] text-muted">{completedCount}/{application.checklist.length}</span></div><div className="space-y-2">{application.checklist.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2.5 text-xs"><input type="checkbox" checked={item.completed} onChange={() => onChecklistToggle(scholarship.id, item.id)} className="mt-0.5 h-4 w-4 rounded border-line accent-green" /><span className={item.completed ? 'text-muted line-through' : 'font-medium text-ink'}>{item.task}</span></label>)}</div></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#FAFBF9] px-5 py-3"><button onClick={() => onOpen(scholarship)} className="btn-ghost px-1">View requirements <ArrowUpRight size={13} /></button><label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-muted">Stage<select aria-label={`Change stage for ${scholarship.title}`} value={application.stage} onChange={(event) => onStageChange(scholarship.id, event.target.value as ApplicationStage)} className="rounded-lg border border-line bg-white px-2 py-2 text-xs font-semibold normal-case tracking-normal text-ink outline-none focus:border-green">{stageOrder.map((stage) => { const gate = validateApplicationStageChange(application, stage, assessment); return <option key={stage} value={stage} disabled={!gate.allowed}>{stageLabels[stage]}</option>; })}</select></label></div>
      </Card>;
    })}</div><DemoNotice /></div>;
}

function DocumentsPage({ documents, onStatusChange }: { documents: DocumentRecord[]; onStatusChange: (id: string) => void }) {
  const groups = ['Academic', 'Financial', 'Identity', 'Other'];
  const counts = { verified: documents.filter((doc) => doc.status === 'verified').length, uploaded: documents.filter((doc) => doc.status === 'uploaded').length, missing: documents.filter((doc) => doc.status === 'missing').length };
  return <div className="space-y-6"><div className="rounded-[24px] bg-[#EAF0E9] px-5 py-6 sm:px-7"><div className="eyebrow text-green-dark">Document center</div><h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em] text-ink sm:text-[30px]">Know what you have. Know what you still need.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Track document metadata and simulated verification states. This demo never stores actual document files or sensitive contents.</p><div className="mt-5 grid max-w-xl grid-cols-3 gap-2"><MiniCount label="Verified" value={counts.verified} color="green" /><MiniCount label="Uploaded" value={counts.uploaded} color="amber" /><MiniCount label="Missing" value={counts.missing} color="slate" /></div></div>
    {groups.map((group) => {
      const items = documents.filter((doc) => doc.category === group);
      if (!items.length) return null;
      return <Card key={group} className="overflow-hidden"><div className="border-b border-line px-5 py-4"><h3 className="font-display text-base font-extrabold text-ink">{group} documents</h3><p className="mt-0.5 text-xs text-muted">{items.length} tracked item{items.length > 1 ? 's' : ''}</p></div><div className="divide-y divide-line">{items.map((doc) => <div key={doc.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${doc.status === 'verified' ? 'bg-green-soft text-green-dark' : doc.status === 'uploaded' ? 'bg-amber-soft text-amber' : 'bg-slate-100 text-slate-500'}`}>{doc.status === 'verified' ? <ShieldCheck size={18} /> : doc.status === 'uploaded' ? <Upload size={18} /> : <FileText size={18} />}</div><div className="min-w-0 flex-1"><div className="text-sm font-bold text-ink">{doc.label}</div><div className="mt-0.5 text-[10px] text-muted">Updated {new Date(doc.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · Metadata only</div></div><DocumentStatus status={doc.status} /><button onClick={() => onStatusChange(doc.id)} aria-label={`${doc.status === 'missing' ? 'Mark uploaded' : doc.status === 'uploaded' ? 'Mark verified' : 'Mark missing'}: ${doc.label}`} className="btn-secondary px-3 py-2 text-xs">{doc.status === 'missing' ? 'Mark uploaded' : doc.status === 'uploaded' ? 'Mark verified' : 'Mark missing'}</button></div>)}</div></Card>;
    })}
    <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><p><strong>Demo privacy notice.</strong> Document names, categories, statuses, profile fields, and timestamps stay in this browser&apos;s LocalStorage and are not encrypted. Use fictional details only. Do not enter identity numbers or upload real certificates.</p></div>
  </div>;
}

function DocumentStatus({ status }: { status: DocumentRecord['status'] }) {
  if (status === 'verified') return <span className="inline-flex items-center gap-1 rounded-full bg-green-soft px-2.5 py-1 text-[10px] font-bold text-green-dark"><CheckCircle2 size={12} /> Verified</span>;
  if (status === 'uploaded') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2.5 py-1 text-[10px] font-bold text-amber"><Clock3 size={12} /> Uploaded</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"><CircleAlert size={12} /> Missing</span>;
}

function MiniCount({ label, value, color }: { label: string; value: number; color: 'green' | 'amber' | 'slate' }) {
  return <div className="rounded-xl border border-white/80 bg-white/80 p-3"><div className={`font-display text-xl font-extrabold ${color === 'green' ? 'text-green-dark' : color === 'amber' ? 'text-amber' : 'text-ink'}`}>{value}</div><div className="mt-0.5 text-[10px] font-bold text-muted">{label}</div></div>;
}

function ProfilePage({ profile, onSave }: { profile: StudentProfile; onSave: (profile: StudentProfile) => void }) {
  const [draft, setDraft] = useState<StudentProfile>(profile);
  const [saved, setSaved] = useState(false);
  const changed = JSON.stringify(draft) !== JSON.stringify(profile);
  const patch = (key: keyof StudentProfile, value: string | number | undefined) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false); };
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(draft); setSaved(true); };
  return <div className="grid gap-6 xl:grid-cols-[1fr_.7fr]"><Card className="p-5 sm:p-7"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-soft text-green-dark"><UserRound size={20} /></div><div><div className="eyebrow">Student profile</div><h2 className="font-display text-xl font-extrabold text-ink">Your information</h2></div></div><p className="mt-3 max-w-xl text-xs leading-5 text-muted">Keep these details accurate. GRANTLY uses them to evaluate explicit scholarship requirements; unknown information stays unresolved rather than being treated as a failure.</p>
    <form onSubmit={submit} className="mt-6 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className="field" value={draft.name} onChange={(e) => patch('name', e.target.value)} required /></Field><Field label="Email address"><input className="field" type="email" value={draft.email} onChange={(e) => patch('email', e.target.value)} required /></Field><Field label="Study level"><select className="field" value={draft.level} onChange={(e) => patch('level', e.target.value as StudentProfile['level'])}><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option></select></Field><Field label="Academic score / GPA (out of 10)"><input className="field" type="number" min="0" max="10" step="0.01" value={draft.gpa ?? ''} onChange={(e) => patch('gpa', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="e.g. 8.2" /></Field><Field label="Annual family income (₹)"><input className="field" type="number" min="0" value={draft.familyIncome ?? ''} onChange={(e) => patch('familyIncome', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Enter annual income" /></Field><Field label="State / union territory"><select className="field" value={draft.state} onChange={(e) => patch('state', e.target.value)}><option>Karnataka</option><option>Kerala</option><option>Tamil Nadu</option><option>Andhra Pradesh</option><option>Telangana</option><option>Maharashtra</option><option>Delhi</option><option>Uttar Pradesh</option><option>Other</option></select></Field><Field label="Applicant category"><select className="field" value={draft.category} onChange={(e) => patch('category', e.target.value)}><option value="general">General</option><option value="obc">OBC</option><option value="sc">SC</option><option value="st">ST</option><option value="first_generation">First-generation learner</option><option value="other">Other / prefer not to say</option></select></Field></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"><p className="text-[10px] text-muted">Changes update scholarship assessments immediately after saving.</p><button type="submit" disabled={!changed} className="btn-primary">{saved ? <><Check size={15} /> Saved</> : 'Save profile changes'}</button></div></form>
  </Card>
  <div className="space-y-4"><Card className="p-5"><div className="flex items-center gap-2 text-green-dark"><Activity size={17} /><span className="text-xs font-bold">How your profile is used</span></div><h3 className="mt-3 font-display text-lg font-extrabold text-ink">Transparent by default.</h3><p className="mt-2 text-xs leading-5 text-muted">Each requirement is evaluated against a field in your profile. The assessment explains the result and suggests a concrete next step when information is missing or does not satisfy a condition.</p><div className="mt-4 space-y-2"><div className="flex items-center gap-2 text-xs text-ink"><CheckCircle2 size={14} className="text-green" /> Missing data is not an automatic failure.</div><div className="flex items-center gap-2 text-xs text-ink"><CheckCircle2 size={14} className="text-green" /> Every requirement has its own explanation.</div><div className="flex items-center gap-2 text-xs text-ink"><CheckCircle2 size={14} className="text-green" /> Final decisions stay with providers.</div></div></Card><Card className="p-5"><div className="eyebrow">Local data</div><h3 className="mt-2 text-sm font-extrabold text-ink">Your workspace stays in this browser.</h3><p className="mt-1 text-xs leading-5 text-muted">Profile fields, application stages, checklist progress, and document metadata are saved unencrypted in this browser&apos;s LocalStorage. Use fictional details only; do not enter real income, identity, or account information. This demo has no backend or cross-device sync.</p></Card></div>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-ink">{label}</span>{children}</label>;
}

function EmptyState({ icon: Icon, title, description, cta, onClick }: { icon: typeof Compass; title: string; description: string; cta: string; onClick: () => void }) {
  return <Card className="px-6 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-soft text-green-dark"><Icon size={24} /></div><h2 className="mt-4 font-display text-xl font-extrabold text-ink">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p><button onClick={onClick} className="btn-primary mt-5">{cta} <ArrowRight size={14} /></button></Card>;
}

function DemoNotice() {
  return <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900"><CircleAlert size={15} className="mt-0.5 shrink-0" /><p><strong>Demonstration environment.</strong> Scholarship names, providers, amounts, deadlines, and source references in this prototype are fictional sample data. They are not real or verified funding offers.</p></div>;
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  const profile = candidate.profile;
  if (!profile || typeof profile !== 'object') return false;
  const documentsValid = Array.isArray(candidate.documents) && candidate.documents.every((document) =>
    document && typeof document.id === 'string' && typeof document.category === 'string' &&
    typeof document.label === 'string' && ['missing', 'uploaded', 'verified'].includes(document.status) &&
    typeof document.updatedAt === 'string',
  );
  const applicationsValid = Array.isArray(candidate.applications) && candidate.applications.every((application) =>
    application && typeof application.scholarshipId === 'string' &&
    ['saved', 'preparing', 'ready', 'applied', 'under_review', 'completed'].includes(application.stage) &&
    typeof application.deadline === 'string' && Array.isArray(application.checklist) &&
    application.checklist.every((item) => item && typeof item.id === 'string' && typeof item.task === 'string' && typeof item.completed === 'boolean'),
  );
  return typeof profile.name === 'string' && typeof profile.email === 'string' &&
    ['undergraduate', 'postgraduate'].includes(profile.level) && typeof profile.category === 'string' &&
    typeof profile.state === 'string' &&
    (profile.gpa === undefined || (typeof profile.gpa === 'number' && Number.isFinite(profile.gpa))) &&
    (profile.familyIncome === undefined || (typeof profile.familyIncome === 'number' && Number.isFinite(profile.familyIncome))) &&
    documentsValid && applicationsValid && Array.isArray(candidate.savedScholarshipIds) &&
    candidate.savedScholarshipIds.every((id) => typeof id === 'string');
}


function OnboardingWizard({ profile, documents, onComplete, onSkip }: {
  profile: StudentProfile;
  documents: DocumentRecord[];
  onComplete: (profile: StudentProfile) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<StudentProfile>(profile);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogAccessibility(dialogRef, onSkip);

  const assessments = useMemo(() => Object.fromEntries(
    scholarships.map((scholarship) => [scholarship.id, evaluateEligibility(draft, scholarship, documents)]),
  ) as Record<string, EligibilityAssessment>, [draft, documents]);
  const potentialMatches = useMemo(
    () => rankScholarships(scholarships, assessments).filter((item) => item.fitLabel === 'Strong fit' || item.fitLabel === 'Potential fit').length,
    [assessments],
  );

  const steps = [
    { eyebrow: '01 · STUDY LEVEL', title: 'Where are you in your education?', description: 'Start with the study level used by many scholarship requirements.' },
    { eyebrow: '02 · LOCATION', title: 'Where do you study or live?', description: 'Some opportunities have state-specific conditions. Choose the closest match.' },
    { eyebrow: '03 · APPLICANT CATEGORY', title: 'Would you like to add an applicant category?', description: 'This is optional context. Current demo rules do not filter opportunities by category.' },
    { eyebrow: '04 · ACADEMICS', title: 'Add your current academic score', description: 'Use a sample score if you want to see academic requirements update. You can skip this.' },
    { eyebrow: '05 · FINANCIAL CONTEXT', title: 'Add an annual family-income figure?', description: 'Income-based rules may remain unresolved if you leave this blank. Use fictional demo values only.' },
  ];
  const update = (key: keyof StudentProfile, value: string | number | undefined) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const submitStep = (event: FormEvent) => {
    event.preventDefault();
    if (step < steps.length - 1) setStep((current) => current + 1);
    else onComplete(draft);
  };
  const skipStep = () => {
    if (step === steps.length - 1) onComplete(draft);
    else setStep((current) => current + 1);
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/55 p-3 backdrop-blur-sm sm:p-6" role="presentation">
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-[26px] bg-white shadow-lift">
      <div className="bg-ink px-6 py-6 text-white sm:px-8 sm:py-7">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#B9DCCB]"><GraduationCap size={16} /> GRANTLY · Personalize your workspace</div>
          <button type="button" onClick={onSkip} aria-label="Skip onboarding and use the sample profile" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
        <div className="mt-6 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.12em] text-slate-300"><span>Build your starting profile</span><span>{steps[step].eyebrow} · Step {step + 1} of {steps.length}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#BDE2CC] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <h2 id="onboarding-title" className="mt-5 font-display text-2xl font-extrabold tracking-[-.04em] sm:text-[30px]">{steps[step].title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{steps[step].description}</p>
      </div>
      <form onSubmit={submitStep} className="space-y-6 px-6 py-6 sm:px-8 sm:py-7">
        {step === 0 && <div className="grid gap-4 sm:grid-cols-2"><Field label="What should we call you?"><input autoFocus data-dialog-initial-focus className="field" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" required /></Field><Field label="Study level"><select className="field" value={draft.level} onChange={(event) => update('level', event.target.value as StudentProfile['level'])}><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option></select></Field></div>}
        {step === 1 && <Field label="State / union territory"><select autoFocus data-dialog-initial-focus className="field" value={draft.state} onChange={(event) => update('state', event.target.value)}><option>Karnataka</option><option>Kerala</option><option>Tamil Nadu</option><option>Andhra Pradesh</option><option>Telangana</option><option>Maharashtra</option><option>Delhi</option><option>Other</option></select></Field>}
        {step === 2 && <Field label="Applicant category (optional)"><select autoFocus data-dialog-initial-focus className="field" value={draft.category} onChange={(event) => update('category', event.target.value)}><option value="general">General</option><option value="obc">OBC</option><option value="sc">SC</option><option value="st">ST</option><option value="first_generation">First-generation learner</option><option value="prefer_not_to_say">Prefer not to say</option></select></Field>}
        {step === 3 && <Field label="Academic score / GPA out of 10 (optional)"><input autoFocus data-dialog-initial-focus className="field" type="number" min="0" max="10" step="0.01" value={draft.gpa ?? ''} onChange={(event) => update('gpa', event.target.value === '' ? undefined : Number(event.target.value))} placeholder="For example, 8.2" /><span className="mt-1.5 block text-[11px] text-muted">Leave blank if you prefer not to share it in this demo.</span></Field>}
        {step === 4 && <Field label="Annual family income in ₹ (optional)"><input autoFocus data-dialog-initial-focus className="field" type="number" min="0" value={draft.familyIncome ?? ''} onChange={(event) => update('familyIncome', event.target.value === '' ? undefined : Number(event.target.value))} placeholder="For example, 450000" /><span className="mt-1.5 block text-[11px] text-muted">Leave blank to keep income-based requirements marked as needing verification.</span></Field>}
        <div className="rounded-2xl border border-green/15 bg-[#F0F5F0] p-4">
          <div className="flex items-end justify-between gap-3">
            <div><div className="eyebrow text-green-dark">Live from your profile</div><div className="mt-1 font-display text-2xl font-extrabold text-ink">{potentialMatches} potential match{potentialMatches === 1 ? '' : 'es'}</div><p className="mt-1 text-[11px] leading-4 text-muted">Across {scholarships.length} fictional demo opportunities, using the current requirement rules.</p></div>
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-green-dark sm:flex"><Target size={20} /></div>
          </div>
        </div>
        <p className="text-[10px] leading-4 text-muted">Demo privacy note: use fictional values only. Profile data stays unencrypted in this browser. Applicant category is optional and does not affect current sample matching rules.</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <button type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)} className="btn-secondary px-3 disabled:opacity-40">Back</button>
            {step >= 2 && <button type="button" onClick={skipStep} className="btn-ghost px-2">Skip question</button>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSkip} className="hidden text-xs font-semibold text-muted hover:text-ink sm:inline-flex">Use sample profile</button>
            <button type="submit" className="btn-primary">{step === steps.length - 1 ? 'Show my matches' : 'Continue'} <ArrowRight size={14} /></button>
          </div>
        </div>
      </form>
    </section>
  </div>;
}

function App() {
  const [state, setState] = useLocalStorage<AppState>('grantly-workspace-v1', initialState, isAppState);
  const [onboardingComplete, setOnboardingComplete] = useLocalStorage<boolean>('grantly-onboarding-complete-v1', false, (value): value is boolean => typeof value === 'boolean');
  const [page, setPage] = useState<Page>('overview');
  const [selectedScholarshipId, setSelectedScholarshipId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const assessments = useMemo(() => Object.fromEntries(scholarships.map((scholarship) => [scholarship.id, assessmentFor(state, scholarship)])) as Record<string, EligibilityAssessment>, [state.profile, state.documents]);
  const recommendations = useMemo(() => rankScholarships(scholarships, assessments), [assessments]);
  const actions = useMemo(() => {
    const relevant = new Set(state.applications.map((application) => application.scholarshipId));
    recommendations
      .filter((item) => item.fitLabel === 'Strong fit' || item.fitLabel === 'Potential fit')
      .slice(0, 3)
      .forEach((item) => relevant.add(item.scholarship.id));
    const allActions = Array.from(relevant).flatMap((id) => {
      const scholarship = scholarships.find((item) => item.id === id);
      if (!scholarship) return [];
      const application = state.applications.find((item) => item.scholarshipId === id);
      return generateNextActions(assessments[id], scholarship, application);
    });
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const daysFor = (action: ActionItem) => action.scholarshipId
      ? recommendations.find((item) => item.scholarship.id === action.scholarshipId)?.deadline.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    return allActions.sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      daysFor(a) - daysFor(b) ||
      a.title.localeCompare(b.title),
    ).slice(0, 12);
  }, [state.applications, assessments, recommendations]);

  const selectedScholarship = scholarships.find((item) => item.id === selectedScholarshipId) ?? null;
  const selectedAssessment = selectedScholarship ? assessments[selectedScholarship.id] : null;

  const notify = (message: string) => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast('');
      toastTimeoutRef.current = null;
    }, 2800);
  };

  const toggleSaved = (scholarshipId: string) => {
    setState((previous) => ({
      ...previous,
      savedScholarshipIds: previous.savedScholarshipIds.includes(scholarshipId)
        ? previous.savedScholarshipIds.filter((id) => id !== scholarshipId)
        : [...previous.savedScholarshipIds, scholarshipId],
    }));
  };

  const addApplication = (scholarshipId: string) => {
    const scholarship = scholarships.find((item) => item.id === scholarshipId);
    if (!scholarship) return;
    if (!isDeadlineOpenForApplication(scholarship.deadline)) {
      notify('This opportunity is closed or has no valid deadline, so it cannot be added as a new application.');
      return;
    }
    setState((previous) => {
      if (previous.applications.some((application) => application.scholarshipId === scholarshipId)) return previous;
      const checklist = [
        { id: `${scholarshipId}-review`, task: 'Review scholarship requirements', completed: false },
        ...scholarship.requirements.filter((requirement) => requirement.requiredDocumentId).map((requirement) => {
          const document = previous.documents.find((item) => item.id === requirement.requiredDocumentId);
          return { id: `${scholarshipId}-${requirement.id}`, task: `Prepare / verify ${document?.label.toLowerCase() ?? 'required document'}`, completed: document?.status === 'verified' };
        }),
        { id: `${scholarshipId}-form`, task: 'Complete application form', completed: false },
      ];
      return {
        ...previous,
        savedScholarshipIds: previous.savedScholarshipIds.includes(scholarshipId) ? previous.savedScholarshipIds : [...previous.savedScholarshipIds, scholarshipId],
        applications: [...previous.applications, { scholarshipId, stage: 'preparing', checklist, deadline: scholarship.deadline }],
      };
    });
    setPage('applications');
    setSelectedScholarshipId(null);
    notify('Scholarship added to your application workspace.');
  };

  const updateStage = (scholarshipId: string, stage: ApplicationStage) => {
    const application = state.applications.find((item) => item.scholarshipId === scholarshipId);
    const assessment = assessments[scholarshipId];
    if (!application || !assessment) return;
    const validation = validateApplicationStageChange(application, stage, assessment);
    if (!validation.allowed) {
      notify(validation.reason);
      return;
    }
    setState((previous) => ({ ...previous, applications: previous.applications.map((item) => item.scholarshipId === scholarshipId ? { ...item, stage } : item) }));
    notify(`Application moved to ${stageLabels[stage].toLowerCase()}.`);
  };

  const toggleChecklist = (scholarshipId: string, checklistId: string) => {
    setState((previous) => ({
      ...previous,
      applications: previous.applications.map((application) => {
        if (application.scholarshipId !== scholarshipId) return application;
        const checklist = application.checklist.map((item) => item.id === checklistId ? { ...item, completed: !item.completed } : item);
        const scholarship = scholarships.find((item) => item.id === scholarshipId);
        if (!scholarship) return { ...application, checklist };
        const assessment = evaluateEligibility(previous.profile, scholarship, previous.documents);
        return reconcileApplicationStage({ ...application, checklist }, assessment);
      }),
    }));
  };

  const updateDocumentStatus = (documentId: string) => {
    setState((previous) => {
      const currentDocument = previous.documents.find((document) => document.id === documentId);
      if (!currentDocument) return previous;
      const nextStatus: DocumentRecord['status'] = currentDocument.status === 'missing' ? 'uploaded' : currentDocument.status === 'uploaded' ? 'verified' : 'missing';
      const nextDocuments = previous.documents.map((document) => document.id === documentId
        ? { ...document, status: nextStatus, updatedAt: new Date().toISOString() }
        : document);
      const nextApplications = previous.applications.map((application) => {
        const scholarship = scholarships.find((item) => item.id === application.scholarshipId);
        if (!scholarship) return application;
        const documentChecklistIds = new Set(
          scholarship.requirements
            .filter((requirement) => requirement.requiredDocumentId === documentId)
            .map((requirement) => `${scholarship.id}-${requirement.id}`),
        );
        const checklist = application.checklist.map((item) => {
          // Match stable requirement-derived IDs and older saved checklist tasks
          // so workspaces created before this update continue to synchronize.
          const isRelatedDocumentTask = documentChecklistIds.has(item.id) ||
            item.task.toLowerCase().includes(currentDocument.label.toLowerCase());
          return isRelatedDocumentTask ? { ...item, completed: nextStatus === 'verified' } : item;
        });
        const assessment = evaluateEligibility(previous.profile, scholarship, nextDocuments);
        return reconcileApplicationStage({ ...application, checklist }, assessment);
      });
      return { ...previous, documents: nextDocuments, applications: nextApplications };
    });
    notify('Document status updated. Related assessments and checklists have been refreshed.');
  };

  const handleAction = (action: ActionItem) => {
    if (action.actionType === 'verify_profile') setPage('profile');
    else if (action.actionType === 'upload_document') setPage('documents');
    else if (action.scholarshipId) setSelectedScholarshipId(action.scholarshipId);
  };

  const saveProfile = (profile: StudentProfile) => {
    setState((previous) => {
      const nextApplications = previous.applications.map((application) => {
        const scholarship = scholarships.find((item) => item.id === application.scholarshipId);
        if (!scholarship) return application;
        const assessment = evaluateEligibility(profile, scholarship, previous.documents);
        return reconcileApplicationStage(application, assessment);
      });
      return { ...previous, profile, applications: nextApplications };
    });
    setOnboardingComplete(true);
    notify('Profile saved. Scholarship assessments are up to date.');
  };

  const renderPage = () => {
    if (page === 'overview') return <Dashboard state={state} recommendations={recommendations} actions={actions} onNavigate={setPage} onOpen={(scholarship) => setSelectedScholarshipId(scholarship.id)} onOpenAction={handleAction} />;
    if (page === 'discover') return <Discovery state={state} recommendations={recommendations} onOpen={(scholarship) => setSelectedScholarshipId(scholarship.id)} onSave={toggleSaved} onApply={addApplication} />;
    if (page === 'applications') return <ApplicationsPage state={state} assessments={assessments} onOpen={(scholarship) => setSelectedScholarshipId(scholarship.id)} onStageChange={updateStage} onChecklistToggle={toggleChecklist} onDiscover={() => setPage('discover')} />;
    if (page === 'documents') return <DocumentsPage documents={state.documents} onStatusChange={updateDocumentStatus} />;
    return <ProfilePage key={JSON.stringify(state.profile)} profile={state.profile} onSave={saveProfile} />;
  };

  return <div className="min-h-screen bg-canvas text-ink">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-ink focus:shadow-lift">Skip to main content</a>
    <div className="min-h-screen lg:flex">
      <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none"><Header page={page} profile={state.profile} onMenu={() => setMobileOpen((open) => !open)} menuOpen={mobileOpen} onProfile={() => setPage('profile')} /><div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9"><div className="mb-5 flex items-center gap-2 text-[10px] font-semibold text-muted"><span className="text-green-dark">GRANTLY</span><ChevronRight size={12} /><span className="capitalize">{page === 'overview' ? 'Workspace overview' : page === 'profile' ? 'Student profile' : page === 'discover' ? 'Scholarship discovery' : page === 'documents' ? 'Document center' : 'Application tracker'}</span></div>{renderPage()}</div></main>
    </div>
    {!onboardingComplete && <OnboardingWizard profile={state.profile} documents={state.documents} onComplete={saveProfile} onSkip={() => setOnboardingComplete(true)} />}
    {selectedScholarship && selectedAssessment && <ScholarshipModal scholarship={selectedScholarship} assessment={selectedAssessment} saved={state.savedScholarshipIds.includes(selectedScholarship.id)} applied={state.applications.some((application) => application.scholarshipId === selectedScholarship.id)} onClose={() => setSelectedScholarshipId(null)} onSave={() => toggleSaved(selectedScholarship.id)} onApply={() => addApplication(selectedScholarship.id)} />}
    {toast && <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-semibold text-white shadow-lift"><CheckCircle2 size={15} className="text-[#A5D9BA]" />{toast}</div>}
  </div>;
}

export default App;
