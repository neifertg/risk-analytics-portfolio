"""Classical (pre-LLM) NLP pipeline on IMDB movie reviews.

Rebuilds a 2021 MSBA Text Analytics course project (originally R:
quanteda/tm/topicmodels/cleanNLP) in Python. Same technique set — DTM/TF-IDF
construction with a sparsity comparison, comparative word clouds, LDA topic
modeling, Bing Liu lexicon sentiment scoring, and POS-tagged proper-noun
extraction — plus two things the original script set up but never finished:
a real train/test Naive Bayes classifier, and validating the lexicon
sentiment scores against the actual labels rather than just plotting them.
"""

import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import nltk
import numpy as np
import pandas as pd
from nltk.stem import PorterStemmer
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from wordcloud import WordCloud

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = Path(__file__).parent / "output"
NLTK_DIR = Path(__file__).parent / "nltk_data"
RANDOM_STATE = 1123
TOKEN_RE = re.compile(r"[A-Za-z]+")


def ensure_nltk_resources():
    NLTK_DIR.mkdir(exist_ok=True)
    nltk.data.path.insert(0, str(NLTK_DIR))
    for resource in [
        "stopwords",
        "punkt",
        "punkt_tab",
        "averaged_perceptron_tagger",
        "averaged_perceptron_tagger_eng",
        "opinion_lexicon",
    ]:
        try:
            nltk.download(resource, download_dir=str(NLTK_DIR), quiet=True)
        except Exception:
            pass  # older/newer nltk versions don't all recognize every name


HTML_TAG_RE = re.compile(r"<[^>]+>")


def load_data():
    df = pd.read_csv(DATA_DIR / "reviews_sample.csv")
    # The raw aclImdb text still has literal HTML line breaks ("<br /><br />")
    # scraped along with it — a well-documented quirk of this dataset. Left
    # unstripped, "br" shows up as one of the most frequent "words" in every
    # downstream step (confirmed: it dominated an early word-cloud draft).
    df["review"] = df["review"].str.replace(HTML_TAG_RE, " ", regex=True)
    df["review_length"] = df["review"].str.len()
    return df


def make_stem_tokenizer(stop_words):
    stemmer = PorterStemmer()

    def tokenize(text):
        tokens = TOKEN_RE.findall(text.lower())
        return [stemmer.stem(t) for t in tokens if t not in stop_words and len(t) > 2]

    return tokenize


def dtm_comparison(df, stem_tokenizer):
    raw_vec = CountVectorizer(token_pattern=r"[A-Za-z]+", lowercase=True)
    raw_dtm = raw_vec.fit_transform(df["review"])

    clean_vec = CountVectorizer(tokenizer=stem_tokenizer, token_pattern=None)
    clean_dtm = clean_vec.fit_transform(df["review"])

    def sparsity(mat):
        return 1.0 - (mat.nnz / (mat.shape[0] * mat.shape[1]))

    return {
        "raw_dtm": {
            "n_documents": raw_dtm.shape[0],
            "n_terms": raw_dtm.shape[1],
            "sparsity": round(sparsity(raw_dtm), 4),
        },
        "cleaned_dtm_stopwords_removed_stemmed": {
            "n_documents": clean_dtm.shape[0],
            "n_terms": clean_dtm.shape[1],
            "sparsity": round(sparsity(clean_dtm), 4),
        },
    }, clean_vec, clean_dtm


def top_words_chart(clean_vec, clean_dtm):
    freqs = np.asarray(clean_dtm.sum(axis=0)).ravel()
    terms = np.array(clean_vec.get_feature_names_out())
    order = np.argsort(freqs)[::-1][:20]
    top_terms, top_freqs = terms[order], freqs[order]

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.barh(top_terms[::-1], top_freqs[::-1], color="#4C72B0")
    ax.set_xlabel("Total count across all 5,000 reviews")
    ax.set_title("Top 20 words after stopword removal + stemming")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "top_words.png", dpi=150)
    plt.close(fig)
    return [{"term": t, "count": int(f)} for t, f in zip(top_terms, top_freqs)]


def comparative_wordcloud(df, stop_words):
    fig, axes = plt.subplots(1, 2, figsize=(12, 6))
    for ax, (label, title, color) in zip(
        axes,
        [(1, "Positive reviews", "Greens"), (0, "Negative reviews", "Reds")],
    ):
        text = " ".join(df.loc[df.sentiment == label, "review"])
        wc = WordCloud(
            width=800,
            height=600,
            background_color="white",
            stopwords=stop_words,
            colormap=color,
            max_words=150,
        ).generate(text)
        ax.imshow(wc, interpolation="bilinear")
        ax.set_title(title)
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "wordcloud_comparison.png", dpi=150)
    plt.close(fig)


def lda_topics(clean_vec, clean_dtm, n_topics=5, n_top_words=8):
    lda = LatentDirichletAllocation(
        n_components=n_topics, random_state=RANDOM_STATE, max_iter=25
    )
    lda.fit(clean_dtm)
    perplexity = float(lda.perplexity(clean_dtm))

    # lda.components_ holds raw, unnormalized topic-word pseudo-counts, which
    # aren't comparable across topics (a topic that absorbed more of the
    # corpus has larger raw numbers regardless of how concentrated its top
    # words actually are). Normalize each topic's row to a probability
    # distribution before reporting/plotting, so "weight" means the same
    # thing in every topic.
    topic_word_probs = lda.components_ / lda.components_.sum(axis=1, keepdims=True)

    terms = np.array(clean_vec.get_feature_names_out())
    topics = []
    fig, axes = plt.subplots(1, n_topics, figsize=(4 * n_topics, 4))
    for i, (probs, ax) in enumerate(zip(topic_word_probs, axes)):
        order = np.argsort(probs)[::-1][:n_top_words]
        top_terms = terms[order]
        top_weights = probs[order]
        topics.append(
            {
                "topic": i + 1,
                "top_terms": [
                    {"term": t, "probability": round(float(w), 4)}
                    for t, w in zip(top_terms, top_weights)
                ],
            }
        )
        ax.barh(top_terms[::-1], top_weights[::-1], color="#55A868")
        ax.set_title(f"Topic {i + 1}")
    fig.suptitle("LDA topics (K=5) — top terms by within-topic probability")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "lda_topics.png", dpi=150)
    plt.close(fig)
    return {"perplexity": round(perplexity, 2), "topics": topics}


def bing_liu_sentiment(df):
    from nltk.corpus import opinion_lexicon

    positive_words = set(opinion_lexicon.positive())
    negative_words = set(opinion_lexicon.negative())

    def score(text):
        tokens = TOKEN_RE.findall(text.lower())
        pos = sum(1 for t in tokens if t in positive_words)
        neg = sum(1 for t in tokens if t in negative_words)
        return pos, neg

    scores = df["review"].apply(score)
    df = df.assign(
        lexicon_positive=[s[0] for s in scores],
        lexicon_negative=[s[1] for s in scores],
    )
    df["lexicon_net"] = df["lexicon_positive"] - df["lexicon_negative"]
    df["lexicon_predicted_positive"] = (df["lexicon_net"] > 0).astype(int)

    accuracy = float(accuracy_score(df["sentiment"], df["lexicon_predicted_positive"]))

    fig, ax = plt.subplots(figsize=(6, 5))
    df.boxplot(column="lexicon_net", by="sentiment", ax=ax)
    ax.set_xlabel("True sentiment (0=negative, 1=positive)")
    ax.set_ylabel("Bing Liu lexicon net score (positive words - negative words)")
    ax.set_title("Lexicon sentiment score by true label")
    fig.suptitle("")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "sentiment_validation.png", dpi=150)
    plt.close(fig)

    return {
        "naive_net_gt_zero_rule_accuracy": round(accuracy, 4),
        "mean_net_score_positive_reviews": round(
            float(df.loc[df.sentiment == 1, "lexicon_net"].mean()), 2
        ),
        "mean_net_score_negative_reviews": round(
            float(df.loc[df.sentiment == 0, "lexicon_net"].mean()), 2
        ),
    }


def naive_bayes_classifier(df):
    tfidf_vec = TfidfVectorizer(
        token_pattern=r"[A-Za-z]+", lowercase=True, stop_words="english", max_features=5000
    )
    X = tfidf_vec.fit_transform(df["review"])
    y = df["sentiment"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=RANDOM_STATE, stratify=y
    )
    model = MultinomialNB()
    model.fit(X_train, y_train)
    preds = model.predict(X_test)

    cm = confusion_matrix(y_test, preds)
    fig, ax = plt.subplots(figsize=(5, 4.5))
    im = ax.imshow(cm, cmap="Blues")
    for (i, j), v in np.ndenumerate(cm):
        ax.text(j, i, str(v), ha="center", va="center")
    ax.set_xticks([0, 1], labels=["Predicted neg", "Predicted pos"])
    ax.set_yticks([0, 1], labels=["Actual neg", "Actual pos"])
    ax.set_title("Naive Bayes confusion matrix (test set)")
    fig.colorbar(im)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "nb_confusion_matrix.png", dpi=150)
    plt.close(fig)

    return {
        "train_rows": int(X_train.shape[0]),
        "test_rows": int(X_test.shape[0]),
        "accuracy": round(float(accuracy_score(y_test, preds)), 4),
        "precision": round(float(precision_score(y_test, preds)), 4),
        "recall": round(float(recall_score(y_test, preds)), 4),
        "confusion_matrix": {
            "true_neg": int(cm[0, 0]),
            "false_pos": int(cm[0, 1]),
            "false_neg": int(cm[1, 0]),
            "true_pos": int(cm[1, 1]),
        },
    }


def pos_tag_proper_nouns(df, sample_size=100):
    from collections import Counter

    from nltk import pos_tag, word_tokenize

    sample = df["review"].sample(n=sample_size, random_state=RANDOM_STATE)
    counts = Counter()
    for text in sample:
        tagged = pos_tag(word_tokenize(text))
        counts.update(w for w, tag in tagged if tag == "NNP" and w.isalpha())
    top10 = counts.most_common(10)
    return [{"term": t, "count": c} for t, c in top10]


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    ensure_nltk_resources()
    from nltk.corpus import stopwords as nltk_stopwords

    stop_words = set(nltk_stopwords.words("english"))
    stem_tokenizer = make_stem_tokenizer(stop_words)

    df = load_data()

    length_by_class = (
        df.groupby("sentiment")["review_length"].mean().round(1).to_dict()
    )

    dtm_stats, clean_vec, clean_dtm = dtm_comparison(df, stem_tokenizer)
    top_words = top_words_chart(clean_vec, clean_dtm)
    comparative_wordcloud(df, stop_words)
    lda_results = lda_topics(clean_vec, clean_dtm)
    sentiment_results = bing_liu_sentiment(df)
    nb_results = naive_bayes_classifier(df)
    proper_nouns = pos_tag_proper_nouns(df)

    results = {
        "dataset": {
            "source": "Stanford Large Movie Review Dataset (Maas et al. 2011), "
            "https://ai.stanford.edu/~amaas/data/sentiment/ — substituted for "
            "the original 2021 coursework's unrecoverable Amazon Musical "
            "Instruments review corpus (see README)",
            "n_reviews": int(len(df)),
            "class_balance": df["sentiment"].value_counts().to_dict(),
            "mean_review_length_chars_by_class": {
                "negative": length_by_class.get(0),
                "positive": length_by_class.get(1),
            },
        },
        "document_term_matrix": dtm_stats,
        "top_words_stopwords_removed_stemmed": top_words[:10],
        "lda_topic_modeling": lda_results,
        "bing_liu_lexicon_sentiment": sentiment_results,
        "naive_bayes_classifier": nb_results,
        "pos_tagged_top_proper_nouns_100_review_sample": proper_nouns,
    }
    (OUTPUT_DIR / "results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
