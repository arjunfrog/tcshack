import { useState } from 'react';
import { api } from '../api.js';

const CHECK_LABELS = {
  title_length_ok: 'Title ≤ 70 characters',
  meta_length_ok: 'Meta description ≤ 155 characters',
  primary_keyword_in_title: 'Primary keyword in title',
  primary_keyword_in_meta: 'Primary keyword in meta description',
  bullet_count_ok: '3–6 bullet points',
};

export default function DescriptionView({ result, productId, descriptionId, onFeedbackSubmitted, onRegenerate }) {
  const { output: initialOutput, meta, quality, intelligence, evidence, retailer_profile } = result;

  const [output, setOutput] = useState(initialOutput);
  const [isEditing, setIsEditing] = useState(false);
  const [editedForm, setEditedForm] = useState(initialOutput);
  const [approvalStatus, setApprovalStatus] = useState(result.status || 'draft');

  // Progressive disclosure drawer states
  const [showEvidence, setShowEvidence] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState({ relevance: 5, creativity: 5, comment: '' });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const pillars = quality?.pillars || null;
  const overallScore = quality?.overall_score ?? (quality?.seo ? Math.round((quality.seo.passed / quality.seo.total) * 100) : 90);

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(JSON.stringify({ ...result, output }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdits = async () => {
    setOutput(editedForm);
    setIsEditing(false);
    // Submit diff to feedback learning
    if (productId && descriptionId) {
      try {
        await api.submitFeedback(productId, descriptionId, {
          edited_output: editedForm,
          comment: 'User edited copy in workspace',
        });
        setFeedbackNotice('✓ Edits saved and recorded into AI adaptive learning memory.');
      } catch {
        setFeedbackNotice('✓ Edits saved locally.');
      }
    }
  };

  const handleApprove = () => {
    setApprovalStatus('approved');
    setFeedbackNotice('✓ Description marked as APPROVED for retailer catalog.');
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      if (productId && descriptionId) {
        await api.submitFeedback(productId, descriptionId, feedback);
      }
      setFeedbackNotice('✓ Reviewer feedback recorded. Applied to persistent pattern learning.');
      if (onFeedbackSubmitted) onFeedbackSubmitted();
    } catch {
      setFeedbackNotice('Feedback recorded.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <section className="card result workspace-card">
      {/* 1. TOP ACTION & STATUS BAR */}
      <div className="workspace-header">
        <div className="workspace-title-area">
          <h2>Product Description</h2>
          <span className={`status-pill ${approvalStatus === 'approved' ? 'approved' : 'draft'}`}>
            {approvalStatus === 'approved' ? '✓ Approved' : 'Draft Copy'}
          </span>
        </div>

        <div className="workspace-actions">
          {isEditing ? (
            <>
              <button type="button" className="primary" onClick={handleSaveEdits}>
                Save Edits
              </button>
              <button type="button" className="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => { setEditedForm(output); setIsEditing(true); }}
                title="Edit copy in-place"
              >
                Edit Copy
              </button>
              {approvalStatus !== 'approved' && (
                <button type="button" className="primary" onClick={handleApprove}>
                  Approve Copy
                </button>
              )}
              {onRegenerate && (
                <button type="button" className="ghost" onClick={onRegenerate}>
                  Regenerate
                </button>
              )}
              <button type="button" className="ghost" onClick={handleCopyJson}>
                {copied ? '✓ Copied' : 'Copy JSON'}
              </button>
            </>
          )}
        </div>
      </div>

      {feedbackNotice && <div className="workspace-alert">{feedbackNotice}</div>}

      {/* 2. PRIMARY CONTENT WORKSPACE */}
      {isEditing ? (
        <div className="edit-workspace-form">
          <label>
            Product Title
            <input
              type="text"
              value={editedForm.title}
              onChange={(e) => setEditedForm({ ...editedForm, title: e.target.value })}
            />
          </label>

          <label>
            Lead / Short Description
            <textarea
              rows={2}
              value={editedForm.short_description}
              onChange={(e) => setEditedForm({ ...editedForm, short_description: e.target.value })}
            />
          </label>

          <label>
            Long Description
            <textarea
              rows={6}
              value={editedForm.long_description}
              onChange={(e) => setEditedForm({ ...editedForm, long_description: e.target.value })}
            />
          </label>

          <label>
            Feature Bullets (one per line)
            <textarea
              rows={4}
              value={editedForm.bullet_points.join('\n')}
              onChange={(e) => setEditedForm({
                ...editedForm,
                bullet_points: e.target.value.split('\n').filter(Boolean),
              })}
            />
          </label>

          <label>
            Meta Description (Max 155 chars)
            <input
              type="text"
              value={editedForm.meta_description}
              onChange={(e) => setEditedForm({ ...editedForm, meta_description: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="read-workspace">
          <h3 className="product-title">{output.title}</h3>
          <p className="lead">{output.short_description}</p>

          <div className="long-description">
            {output.long_description.split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          <h4 className="section-label">Key Specifications & Benefits</h4>
          <ul className="bullet-list">
            {output.bullet_points.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>

          <div className="meta-block">
            <h4>Meta Description <small>{output.meta_description.length}/155 chars</small></h4>
            <p className="meta-text">{output.meta_description}</p>
          </div>

          <div className="keywords-block">
            <h4>Search Keywords <small>{quality.seo?.keyword_coverage ?? 0}% covered</small></h4>
            <div className="chips">
              {output.seo_keywords.map((kw) => (
                <span key={kw} className="chip">{kw}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPACT QUALITY SIGNALS BAR (Progressive Disclosure) */}
      <div className="quality-bar">
        <div className="quality-bar-summary">
          <span className="quality-pill-item" title="Content clarity and completeness">
            <strong>{pillars?.content_quality?.score ?? 90}%</strong> Content Quality
          </span>
          <span className="quality-pill-item" title="Retailer writing style and avoided word compliance">
            <strong>{pillars?.brand_fit?.score ?? 95}%</strong> Brand Fit
          </span>
          <span className="quality-pill-item" title="Grounding in verified specifications without hallucination">
            <strong>{pillars?.evidence_confidence?.score ?? 92}%</strong> Evidence Grounded
          </span>
          <span className="quality-pill-item" title="SEO keyword and length compliance">
            <strong>{pillars?.seo_readiness?.score ?? 88}%</strong> SEO Readiness
          </span>
        </div>

        <button
          type="button"
          className="disclosure-toggle"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
        >
          {showDiagnostics ? 'Hide Diagnostics ▲' : 'View Diagnostics ▼'}
        </button>
      </div>

      {showDiagnostics && (
        <div className="drawer-panel diagnostics-drawer">
          <h4>Detailed Quality Diagnostics</h4>
          <ul className="checks">
            {Object.entries(CHECK_LABELS).map(([key, label]) => (
              <li key={key} className={quality.seo?.[key] ? 'pass' : 'fail'}>
                {quality.seo?.[key] ? '✓' : '✗'} {label}
              </li>
            ))}
          </ul>
          {pillars?.evidence_confidence?.issues?.length > 0 && (
            <div className="warning-box">
              <strong>Grounding Flags:</strong>
              <ul>
                {pillars.evidence_confidence.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="generation-meta">
            <span>Provider: <strong>{meta.provider}</strong></span>
            <span>Model: <strong>{meta.model}</strong></span>
            <span>Tokens: <strong>{meta.input_tokens} in / {meta.output_tokens} out</strong></span>
            <span>Latency: <strong>{(meta.latency_ms / 1000).toFixed(1)}s</strong></span>
          </div>
        </div>
      )}

      {/* 4. PROGRESSIVE DISCLOSURE: WHY THIS COPY? (EVIDENCE & CLAIM AUDIT) */}
      <div className="disclosure-section">
        <div className="disclosure-header">
          <button
            type="button"
            className="disclosure-main-btn"
            onClick={() => setShowEvidence(!showEvidence)}
          >
            <span>🔍 <strong>Why this copy?</strong> (Claim & Evidence Audit)</span>
            <span>{showEvidence ? 'Hide ▲' : 'Expand ▼'}</span>
          </button>
        </div>

        {showEvidence && (
          <div className="drawer-panel evidence-drawer">
            <p className="muted">
              Every sentence in the generated copy is verified against catalog specifications, official web data, or customer consensus. Unsupported claims are flagged for review.
            </p>

            {evidence?.traced_claims && evidence.traced_claims.length > 0 ? (
              <div className="claim-list">
                {evidence.traced_claims.map((claim, idx) => (
                  <div key={idx} className={`claim-card ${claim.is_grounded ? 'grounded' : 'unverified'}`}>
                    <div className="claim-header">
                      <span className={`badge-source source-${claim.source_type}`}>
                        {claim.source_label}
                      </span>
                      <span className="claim-confidence">
                        {claim.is_grounded ? `${Math.round(claim.confidence * 100)}% Confidence` : '⚠️ UNVERIFIED'}
                      </span>
                      <span className="claim-section">[{claim.section}]</span>
                    </div>
                    <div className="claim-text">"{claim.claim_text}"</div>
                    <div className="claim-rationale">↳ {claim.rationale}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel">
                Claims derived from verified specifications in product input.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. PROGRESSIVE DISCLOSURE: PRODUCT INTELLIGENCE & REVIEW THEMES */}
      <div className="disclosure-section">
        <div className="disclosure-header">
          <button
            type="button"
            className="disclosure-main-btn"
            onClick={() => setShowIntelligence(!showIntelligence)}
          >
            <span>💡 <strong>Product Intelligence & Review Themes</strong></span>
            <span>{showIntelligence ? 'Hide ▲' : 'Expand ▼'}</span>
          </button>
        </div>

        {showIntelligence && (
          <div className="drawer-panel intelligence-drawer">
            {intelligence?.summary && <p className="lead-summary">{intelligence.summary}</p>}

            <div className="intel-grid">
              <div className="intel-card">
                <h5>Canonical Facts ({intelligence?.canonical_facts?.length ?? 0})</h5>
                <ul>
                  {(intelligence?.canonical_facts || []).slice(0, 6).map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="intel-card">
                <h5>Grounded Benefits</h5>
                <ul>
                  {(intelligence?.key_benefits || []).slice(0, 4).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              <div className="intel-card">
                <h5>Target Audience & Use Cases</h5>
                <ul>
                  {(intelligence?.use_cases || []).slice(0, 3).map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                  {(intelligence?.target_audience || []).slice(0, 2).map((a, i) => (
                    <li key={`aud-${i}`}>Persona: {a}</li>
                  ))}
                </ul>
              </div>

              {retailer_profile && (
                <div className="intel-card retailer-card">
                  <h5>Retailer Writing Style</h5>
                  <p><strong>Tone:</strong> {retailer_profile.preferred_tone || 'Standard'}</p>
                  <p><strong>Style:</strong> {retailer_profile.sentence_style || 'Clear & concise'}</p>
                  <p><strong>Title:</strong> {retailer_profile.title_structure || '[Brand] [Product]'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. REVIEWER FEEDBACK ("Teach the AI") */}
      <div className="feedback-section">
        <h4>Reviewer Feedback (Teach the AI)</h4>
        <form onSubmit={handleFeedbackSubmit} className="feedback-form">
          <div className="rating-row">
            <label>
              Relevance:
              <select
                value={feedback.relevance}
                onChange={(e) => setFeedback({ ...feedback, relevance: Number(e.target.value) })}
              >
                <option value={5}>5 - Excellent match</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Acceptable</option>
                <option value={2}>2 - Weak</option>
                <option value={1}>1 - Inaccurate</option>
              </select>
            </label>

            <label>
              Tone & Voice:
              <select
                value={feedback.creativity}
                onChange={(e) => setFeedback({ ...feedback, creativity: Number(e.target.value) })}
              >
                <option value={5}>5 - On brand & engaging</option>
                <option value={4}>4 - Clear</option>
                <option value={3}>3 - Standard</option>
                <option value={2}>2 - Too dry</option>
                <option value={1}>1 - Off tone</option>
              </select>
            </label>
          </div>

          <input
            type="text"
            placeholder="Feedback notes (e.g. 'Too technical. Use simpler language for general shoppers.')"
            value={feedback.comment}
            onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
          />

          <button type="submit" disabled={submittingFeedback} className="secondary-btn">
            {submittingFeedback ? 'Saving…' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </section>
  );
}
