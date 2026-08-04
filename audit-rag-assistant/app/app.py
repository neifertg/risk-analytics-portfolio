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

import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ANSWER_SCRIPT = PROJECT_ROOT / "scripts" / "answer.mjs"

# A portfolio demo running on a public Streamlit Cloud deployment has no
# rate-limiting of its own — anyone can hit "Ask" and spend real API
# credits. This is a cheap deterrent, not real abuse protection: cap
# questions per browser session rather than building actual rate-limiting
# for what's meant to be a small, low-traffic demo.
MAX_QUESTIONS_PER_SESSION = 5

st.set_page_config(page_title="Audit Procedures RAG Assistant", page_icon="📋")
st.title("Audit Procedures RAG Assistant")
st.caption(
    "Ask a question about the synthetic internal-audit procedures in this "
    "demo corpus. Every answer is grounded and cited from retrieved "
    "excerpts, or the assistant declines rather than guessing — see the "
    "project README for how the retrieval, guardrail, and grounding work."
)


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
st.session_state.setdefault(QUESTION_COUNT_KEY, 0)

if st.session_state[QUESTION_COUNT_KEY] >= MAX_QUESTIONS_PER_SESSION:
    st.warning(
        f"This demo caps questions at {MAX_QUESTIONS_PER_SESSION} per session to keep it "
        "running for everyone. Refresh the page to reset your count."
    )
else:
    with st.form("question_form"):
        question = st.text_input(
            "Question", placeholder="e.g. what's tested in Phase 2 of the SOX 404 walkthrough?"
        )
        submitted = st.form_submit_button("Ask")

    if submitted and question.strip():
        with st.spinner("Retrieving and generating..."):
            try:
                result = ask(question.strip())
                st.session_state["result"] = result
                st.session_state["question"] = question.strip()
                st.session_state["error"] = None
                st.session_state[QUESTION_COUNT_KEY] += 1
            except Exception as exc:
                st.session_state["error"] = str(exc)
                st.session_state["result"] = None

if st.session_state.get("error"):
    st.error(st.session_state["error"])
elif st.session_state.get("result"):
    result = st.session_state["result"]
    st.markdown(f"**Q: {st.session_state['question']}**")

    if result.get("guardrailTriggered"):
        st.info(result["answer"])
    else:
        st.write(result["answer"])
        if result.get("sources"):
            st.subheader("Sources")
            for i, source in enumerate(result["sources"], start=1):
                st.markdown(f"[{i}] {source['title']} — {source['heading']}")

    usage = result.get("usage", {})
    st.caption(
        f"{usage.get('embeddingTokens', 0)} embed + {usage.get('inputTokens', 0)} in "
        f"+ {usage.get('outputTokens', 0)} out tokens "
        f"(~${usage.get('estimatedCostUsd', 0):.5f})"
    )

remaining = MAX_QUESTIONS_PER_SESSION - st.session_state[QUESTION_COUNT_KEY]
if 0 < remaining < MAX_QUESTIONS_PER_SESSION:
    st.caption(f"{remaining} question(s) left this session.")
