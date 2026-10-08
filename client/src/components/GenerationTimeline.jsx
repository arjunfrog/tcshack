import { useEffect, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { Spinner } from './Feedback.jsx';

// Live view of one generation, driven by the progress events the server streams
// (brand -> market research via Anakin -> writing -> checks -> optional fix-up -> save).
// `events` are {stage, status, detail, receivedAt}; nothing here is simulated.

const SOURCE_LABELS = {
  amazon_search_suggestions: { name: 'Amazon search suggestions', unit: 'searches' },
  flipkart_search: { name: 'Flipkart top listings', unit: 'listings' },
};

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const seconds = (ms) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
const ago = (iso) => {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'under an hour ago';
  if (hours < 48) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};

// Folds the event list into the latest state of each stage.
export function summarizeProgress(events) {
  const state = { sources: {} };
  for (const event of events) {
    if (event.stage === 'market_source') {
      state.sources[event.detail.source] = { ...event.detail, status: event.status, at: event.receivedAt };
    } else {
      const previous = state[event.stage];
      state[event.stage] = { status: event.status, detail: event.detail, at: event.receivedAt, startedAt: previous?.startedAt ?? event.receivedAt };
    }
  }
  return state;
}

// Short label for a row in a table ("Researching", "Writing"...).
export function stageLabel(events) {
  const s = summarizeProgress(events);
  if (s.save) return 'Saving';
  if (s.refine?.status === 'start') return 'Polishing';
  if (s.checks) return 'Checking';
  if (s.write?.status === 'start') return 'Writing';
  if (s.market?.status === 'start' || s.market?.status === 'waiting') return 'Researching';
  return 'Starting';
}

export default function GenerationTimeline({ events, startedAt, title = 'Generating description' }) {
  const now = useNow(true);
  const s = summarizeProgress(events);
  const market = s.market;
  const insights = market?.detail?.insights;
  const writing = s.write?.status === 'start';

  const steps = [
    {
      key: 'brand',
      icon: 'store',
      title: 'Brand profile',
      state: s.brand ? 'done' : 'active',
      body: s.brand
        ? <span>{s.brand.detail.business_name ?? 'Your brand'}{s.brand.detail.personality?.length ? ` · ${s.brand.detail.personality.join(', ')}` : ''}</span>
        : <span>Loading your onboarding answers</span>,
    },
    {
      key: 'market',
      icon: 'globe',
      title: 'Market research with Anakin',
      state: !market ? (s.brand ? 'active' : 'pending')
        : market.status === 'start' || market.status === 'waiting' ? 'active'
          : market.status === 'done' ? 'done' : 'skipped',
      body: <MarketBody market={market} sources={s.sources} insights={insights} />,
    },
    {
      key: 'write',
      icon: 'sparkles',
      title: s.write?.detail?.model ? `Writing with ${s.write.detail.model}` : 'Writing the description',
      state: !s.write ? 'pending' : writing ? 'active' : 'done',
      body: writing ? (
        <span className="thinking">Thinking through your product data and brand voice<span className="dots"><i /><i /><i /></span>
          <span className="step-time">{seconds(now - s.write.startedAt)}</span></span>
      ) : s.write ? (
        <span>{s.write.detail.output_tokens ? `${s.write.detail.output_tokens.toLocaleString()} tokens · ` : ''}{seconds(s.write.detail.latency_ms ?? 0)}</span>
      ) : <span>Waiting for research</span>,
    },
    {
      key: 'checks',
      icon: 'shield',
      title: 'Quality checks',
      state: s.checks ? 'done' : 'pending',
      body: s.checks ? <ChecksBody detail={s.checks.detail} /> : <span>SEO, fact check, style and brand words</span>,
    },
    ...(s.refine ? [{
      key: 'refine',
      icon: 'wand',
      title: `Auto-fixing ${s.refine.detail.problems} issue${s.refine.detail.problems === 1 ? '' : 's'}`,
      state: s.refine.status === 'start' ? 'active' : 'done',
      body: s.refine.status === 'start'
        ? <span className="thinking">Asking the model to fix just those<span className="dots"><i /><i /><i /></span></span>
        : <span>{s.refine.detail.accepted ? 'Fix applied: the checks improved' : 'Kept the original: the fix was not better'}</span>,
    }] : []),
    {
      key: 'save',
      icon: 'database',
      title: 'Save to your catalog',
      state: s.save ? 'done' : (s.checks && (!s.refine || s.refine.status === 'done')) ? 'active' : 'pending',
      body: s.save ? <span>Saved as version {s.save.detail.version}</span> : <span>Adds a new version to Supabase</span>,
    },
  ];

  return (
    <section className="card timeline-card" aria-live="polite">
      <div className="timeline-head">
        <span className="timeline-orb"><Icon name="sparkles" size={18} /></span>
        <div>
          <h2>{title}</h2>
          <span className="muted">Live steps from the server</span>
        </div>
        <span className="timeline-elapsed">{seconds(now - startedAt)}</span>
      </div>
      <ol className="timeline">
        {steps.map((step) => (
          <li key={step.key} className={`timeline-step ${step.state}`}>
            <span className="timeline-node">
              {step.state === 'done' ? <Icon name="check" size={15} strokeWidth={2.4} />
                : step.state === 'active' ? <Spinner size={15} />
                  : step.state === 'skipped' ? <Icon name="arrowRight" size={14} />
                    : <Icon name={step.icon} size={15} />}
            </span>
            <div className="timeline-content">
              <strong>{step.title}</strong>
              <div className="timeline-body">{step.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MarketBody({ market, sources, insights }) {
  if (!market) return <span>Looking up what shoppers search for</span>;
  const { status, detail } = market;
  if (status === 'skipped') return <span>Skipped: {detail.reason}</span>;
  if (status === 'failed') return <span>No market data this time; writing without it</span>;
  if (status === 'waiting') return <span>Another product of this type is fetching "{detail.query}"; sharing its results</span>;

  const sourceRows = Object.entries(sources);
  return (
    <>
      {detail.cached
        ? <span>Using saved insights for "{detail.query}" (fetched {ago(detail.fetched_at)})</span>
        : <span>Researching "{detail.query}"</span>}
      {sourceRows.length > 0 && (
        <ul className="source-list">
          {sourceRows.map(([source, info]) => (
            <li key={source} className={info.status}>
              {info.status === 'start' ? <Spinner size={12} /> : info.status === 'done' ? <Icon name="check" size={13} strokeWidth={2.4} /> : <Icon name="x" size={13} />}
              <span>{SOURCE_LABELS[source]?.name ?? source}</span>
              <span className="muted">
                {info.status === 'start' ? 'fetching…' : info.status === 'done' ? `${info.count} ${SOURCE_LABELS[source]?.unit ?? 'results'}` : 'unavailable'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {status === 'done' && insights && (
        <>
          {insights.search_terms?.length > 0 && (
            <div className="insight-group">
              <span className="insight-label">Shoppers search for</span>
              <div className="chips">
                {insights.search_terms.slice(0, 8).map((term, i) => <span key={term} className="chip pop" style={{ animationDelay: `${i * 70}ms` }}>{term}</span>)}
              </div>
            </div>
          )}
          {insights.title_terms?.length > 0 && (
            <div className="insight-group">
              <span className="insight-label">Top listings mention</span>
              <div className="chips">
                {insights.title_terms.slice(0, 6).map((term, i) => <span key={term} className="chip outline pop" style={{ animationDelay: `${(i + 4) * 70}ms` }}>{term}</span>)}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ChecksBody({ detail }) {
  const items = [
    { ok: detail.seo.passed === detail.seo.total, text: `SEO ${detail.seo.passed}/${detail.seo.total}` },
    { ok: detail.facts === 0, text: detail.facts === 0 ? 'No invented facts' : `${detail.facts} fact${detail.facts === 1 ? '' : 's'} to verify` },
    { ok: detail.style === 0, text: detail.style === 0 ? 'Style clean' : `${detail.style} style note${detail.style === 1 ? '' : 's'}` },
    ...(detail.brand_ok === null ? [] : [{ ok: detail.brand_ok, text: detail.brand_ok ? 'Brand words respected' : 'Uses an avoided word' }]),
  ];
  return (
    <div className="check-pills">
      {items.map((item) => <span key={item.text} className={`check-pill ${item.ok ? 'ok' : 'warn'}`}><Icon name={item.ok ? 'check' : 'alert'} size={12} strokeWidth={2.4} /> {item.text}</span>)}
    </div>
  );
}
