"""Download and sample the Stanford Large Movie Review Dataset (IMDB).

Source: Maas et al. 2011, https://ai.stanford.edu/~amaas/data/sentiment/ —
a public research dataset, substituted for the original 2021 coursework's
Amazon Musical Instruments review corpus, which is neither present in the
archive nor cleanly redistributable (see README).
"""

import tarfile
import urllib.request
from pathlib import Path

import pandas as pd

URL = "https://ai.stanford.edu/~amaas/data/sentiment/aclImdb_v1.tar.gz"
RAW_DIR = Path(__file__).parent / "raw"
DATA_DIR = Path(__file__).parent / "data"
ARCHIVE_PATH = RAW_DIR / "aclImdb_v1.tar.gz"
SAMPLE_SIZE = 5000
RANDOM_STATE = 1123  # matches the original coursework's set.seed(1123)


def download():
    RAW_DIR.mkdir(exist_ok=True)
    if ARCHIVE_PATH.exists():
        return
    print(f"Downloading {URL} (~80MB) ...")
    urllib.request.urlretrieve(URL, ARCHIVE_PATH)


def extract():
    if (RAW_DIR / "aclImdb").exists():
        return
    print("Extracting...")
    with tarfile.open(ARCHIVE_PATH) as tar:
        tar.extractall(RAW_DIR, filter="data")


def load_all_labeled_reviews():
    rows = []
    for split in ("train", "test"):
        for label, sentiment in (("pos", 1), ("neg", 0)):
            folder = RAW_DIR / "aclImdb" / split / label
            for f in folder.glob("*.txt"):
                rows.append(
                    {
                        "review": f.read_text(encoding="utf-8"),
                        "sentiment": sentiment,
                        "split_source": split,
                    }
                )
    return pd.DataFrame(rows)


def main():
    download()
    extract()
    df = load_all_labeled_reviews()
    print(f"Loaded {len(df)} labeled reviews (pos+neg, train+test splits combined).")

    half = SAMPLE_SIZE // 2
    pos = df[df.sentiment == 1].sample(n=half, random_state=RANDOM_STATE)
    neg = df[df.sentiment == 0].sample(n=half, random_state=RANDOM_STATE)
    sample = (
        pd.concat([pos, neg])
        .sample(frac=1, random_state=RANDOM_STATE)
        .reset_index(drop=True)
    )

    DATA_DIR.mkdir(exist_ok=True)
    sample.to_csv(DATA_DIR / "reviews_sample.csv", index=False)
    print(f"Wrote {len(sample)} sampled reviews to data/reviews_sample.csv")
    print(sample["sentiment"].value_counts())


if __name__ == "__main__":
    main()
