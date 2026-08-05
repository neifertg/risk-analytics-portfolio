"""Streamlit UI for the audit-procedures RAG assistant.

UI only: shells out to `node scripts/answer.mjs --json` for retrieval,
guardrail, and generation. No RAG logic lives here.

Usage (local):
    streamlit run app/app.py
"""

import json
import os
import subprocess
from pathlib import Path
from string import Template

import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ANSWER_SCRIPT = PROJECT_ROOT / "scripts" / "answer.mjs"
STATS_SCRIPT = PROJECT_ROOT / "scripts" / "stats.mjs"

# A portfolio demo running on a public Streamlit Cloud deployment has no
# rate-limiting of its own — anyone can hit "Ask" and spend real API
# credits. This is a cheap deterrent, not real abuse protection: cap
# questions per browser session rather than building actual rate-limiting
# for what's meant to be a small, low-traffic demo.
MAX_QUESTIONS_PER_SESSION = 5

st.set_page_config(page_title="Audit Procedures RAG Assistant", page_icon="📋")

# Design system ported from the source project (Seth_Wiki's Wiki RAG
# Assistant) — same palette/type tokens as app/.streamlit/config.toml,
# applied here to the custom HTML elements native Streamlit theming
# doesn't reach (the eyebrow label and the sources card). No crest image
# or family branding: this app runs publicly under a real name on a
# professional portfolio, so a plain wordmark stands in for the source
# project's crest mark.
PALETTES = {
    "dark": {
        "eyebrow": "#C9A257",
        "muted": "#A99D86",
        "border": "#332A1D",
        "card_bg": "#1B1712",
        "text": "#EAE2CF",
    },
    "light": {
        "eyebrow": "#93733A",
        "muted": "#6B5A3E",
        "border": "#E4D6B8",
        "card_bg": "#FCF8EE",
        "text": "#1B1712",
    },
}
palette = PALETTES[st.context.theme.type]

CSS_TEMPLATE = Template(
    """
    <style>
    .block-container {
        max-width: 860px;
        padding-top: 2.5rem;
        padding-bottom: 3rem;
    }
    .rag-eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 12px;
        font-weight: 700;
        color: $eyebrow;
        margin: 0 0 6px;
    }
    .rag-lede {
        color: $muted;
        font-size: 15px;
        line-height: 1.55;
        max-width: 60ch;
        margin: 4px 0 0;
    }
    .rag-coverage {
        color: $muted;
        font-size: 13px;
        line-height: 1.5;
        max-width: 60ch;
        margin: 6px 0 0;
    }
    .examples-label {
        color: $muted;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 18px 0 6px;
    }
    .source-card {
        border: 1px solid $border;
        border-radius: 0.85rem;
        background: $card_bg;
        padding: 18px 22px;
        margin-top: 12px;
    }
    .source-card .source-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 700;
        color: $muted;
        margin: 0 0 10px;
    }
    .source-card ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .source-card li {
        font-size: 14px;
        color: $text;
    }
    .source-card .usage-line {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid $border;
        font-size: 12px;
        color: $muted;
        font-variant-numeric: tabular-nums;
    }
    </style>
    """
)
st.markdown(CSS_TEMPLATE.substitute(**palette), unsafe_allow_html=True)

st.markdown(
    '<p class="rag-eyebrow">Risk &amp; Audit Analytics Portfolio</p>',
    unsafe_allow_html=True,
)
st.title("Audit Procedures RAG Assistant")
st.markdown(
    "<p class=\"rag-lede\">Ask a question about the synthetic internal-audit "
    "procedures in this demo corpus. Every answer is grounded and cited "
    "from retrieved excerpts, or the assistant declines rather than "
    "guessing — see the project README for how the retrieval, guardrail, "
    "and grounding work.</p>",
    unsafe_allow_html=True,
)


@st.cache_data(ttl=300)
def get_stats() -> dict:
    """Live corpus-coverage stats, read fresh each time (5-minute cache)
    rather than hand-written, so the coverage line and sidebar can't drift
    out of sync with the actual corpus the way a static description would."""
    result = subprocess.run(
        ["node", str(STATS_SCRIPT), "--json"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        return {}
    return json.loads(result.stdout)


stats = get_stats()
if stats:
    st.markdown(
        f'<p class="rag-coverage">Indexed: {stats["totalDocs"]} synthetic '
        f'procedure documents ({stats["sectionChunks"]} sections).</p>',
        unsafe_allow_html=True,
    )
    with st.sidebar.expander("Coverage", expanded=False):
        st.caption(f"{stats['totalDocs']} documents indexed")
        for topic in stats.get("topics", []):
            st.markdown(f"- {topic['title']}")


def ask(question: str) -> dict:
    env = os.environ.copy()
    # On Streamlit Community Cloud, these come from that app's own Secrets
    # manager (st.secrets), forwarded here as env vars for the Node
    # subprocess; secrets.mjs falls back to ~/.claude/secrets.yaml locally.
    # st.secrets itself raises if no secrets.toml exists anywhere, which is
    # the normal case for local dev — that's not an error, it just means
    # "nothing to forward, let the Node script's own file fallback handle it."
    try:
        for key in ("anthropic_api_key", "voyage_api_key"):
            if key in st.secrets:
                env_name = "ANTHROPIC_API_KEY" if key == "anthropic_api_key" else "VOYAGE_API_KEY"
                env[env_name] = st.secrets[key]
    except Exception:
        pass

    result = subprocess.run(
        ["node", str(ANSWER_SCRIPT), question, "--json"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "answer.mjs failed with no error output.")
    return json.loads(result.stdout)


QUESTION_COUNT_KEY = "question_count"
SESSION_TOTALS_KEY = "session_totals"
st.session_state.setdefault(QUESTION_COUNT_KEY, 0)


def run_query(q: str) -> None:
    with st.spinner("Retrieving and generating..."):
        try:
            result = ask(q)
            st.session_state["result"] = result
            st.session_state["question"] = q
            st.session_state["error"] = None
            st.session_state[QUESTION_COUNT_KEY] += 1

            usage = result.get("usage", {})
            totals = st.session_state.setdefault(
                SESSION_TOTALS_KEY,
                {"embeddingTokens": 0, "inputTokens": 0, "outputTokens": 0, "costUsd": 0.0},
            )
            totals["embeddingTokens"] += usage.get("embeddingTokens", 0)
            totals["inputTokens"] += usage.get("inputTokens", 0)
            totals["outputTokens"] += usage.get("outputTokens", 0)
            totals["costUsd"] += usage.get("estimatedCostUsd", 0.0)
        except Exception as exc:
            st.session_state["error"] = str(exc)
            st.session_state["result"] = None


if st.session_state[QUESTION_COUNT_KEY] >= MAX_QUESTIONS_PER_SESSION:
    st.warning(
        f"This demo caps questions at {MAX_QUESTIONS_PER_SESSION} per session to keep it "
        "running for everyone. Refresh the page to reset your count."
    )
else:
    # Pulled straight from evals/questions.json, spanning both flavors of
    # the corpus (fieldwork testing, governance) — known to retrieve well
    # rather than a placeholder guess at what the corpus covers.
    EXAMPLE_QUESTIONS = [
        "What's tested in Phase 2 of the SOX 404 key controls walkthrough?",
        "Does internal audit own the enterprise risk register, or just provide assurance over it?",
        "What three documents does a three-way match compare before a purchase invoice can be paid?",
    ]
    st.markdown('<p class="examples-label">Try one:</p>', unsafe_allow_html=True)
    example_cols = st.columns(len(EXAMPLE_QUESTIONS))
    for col, eq in zip(example_cols, EXAMPLE_QUESTIONS):
        if col.button(eq, use_container_width=True, key=f"example_{eq}"):
            run_query(eq)

    with st.form("question_form"):
        question = st.text_input(
            "Question", placeholder="e.g. what's tested in Phase 2 of the SOX 404 walkthrough?"
        )
        submitted = st.form_submit_button("Ask")

    if submitted and question.strip():
        run_query(question.strip())

if st.session_state.get("error"):
    st.error(st.session_state["error"])
elif st.session_state.get("result"):
    result = st.session_state["result"]
    st.markdown(f"**Q: {st.session_state['question']}**")

    usage = result.get("usage", {})
    usage_line = (
        f"{usage.get('embeddingTokens', 0)} embed + {usage.get('inputTokens', 0)} in "
        f"+ {usage.get('outputTokens', 0)} out tokens "
        f"(~${usage.get('estimatedCostUsd', 0):.5f})"
    )

    if result.get("guardrailTriggered"):
        st.info(result["answer"])
        st.caption(usage_line)
    else:
        st.write(result["answer"])

        if result.get("sources"):
            sources_html = "".join(
                f"<li>[{i}] {source['title']} — {source['heading']}</li>"
                for i, source in enumerate(result["sources"], start=1)
            )
            st.markdown(
                f"""
                <div class="source-card">
                    <p class="source-title">Sources</p>
                    <ul>{sources_html}</ul>
                    <p class="usage-line">{usage_line}</p>
                </div>
                """,
                unsafe_allow_html=True,
            )
        else:
            st.caption(usage_line)

remaining = MAX_QUESTIONS_PER_SESSION - st.session_state[QUESTION_COUNT_KEY]
if 0 < remaining < MAX_QUESTIONS_PER_SESSION:
    st.caption(f"{remaining} question(s) left this session.")

totals = st.session_state.get(SESSION_TOTALS_KEY)
if totals:
    st.sidebar.metric("Session cost (est.)", f"${totals['costUsd']:.4f}")
    st.sidebar.caption(
        f"{totals['embeddingTokens']} embed + {totals['inputTokens']} in "
        f"+ {totals['outputTokens']} out tokens this session"
    )
