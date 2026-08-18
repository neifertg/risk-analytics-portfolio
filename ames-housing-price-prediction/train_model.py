"""Ames Housing sale-price prediction: Ridge vs. Lasso vs. Random Forest.

Rebuilds a 2021 MSBA coursework project (originally R/glmnet/caret) in
Python/scikit-learn. Same methodology — domain-aware missing-value
handling, log-transformed target, regularized linear models tuned via
cross-validation, and a Random Forest with feature importances — evaluated
here on a held-out split of the original labeled training data (see
README for why: the original workflow scored against Kaggle's unlabeled
competition test.csv via leaderboard submission, which this rebuild
doesn't have access to).
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Lasso, Ridge
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, KFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = Path(__file__).parent / "output"
RANDOM_STATE = 42

# Per the dataset's data_description.txt, NA in these columns means the
# house doesn't have that feature at all, not that the value is unknown.
NONE_MEANS_ABSENT_CATEGORICAL = [
    "PoolQC", "MiscFeature", "Alley", "Fence", "FireplaceQu",
    "GarageType", "GarageFinish", "GarageQual", "GarageCond",
    "BsmtQual", "BsmtCond", "BsmtExposure", "BsmtFinType1", "BsmtFinType2",
    "MasVnrType",
]


def load_data():
    return pd.read_csv(DATA_DIR / "train.csv")


def clean(df):
    df = df.copy()
    for col in NONE_MEANS_ABSENT_CATEGORICAL:
        df[col] = df[col].fillna("None")
    df["MasVnrArea"] = df["MasVnrArea"].fillna(0)
    # No garage means no meaningful garage-built year; use the house's own
    # build year rather than a placeholder that would read as a real date.
    df["GarageYrBlt"] = df["GarageYrBlt"].fillna(df["YearBuilt"])
    df["LotFrontage"] = df["LotFrontage"].fillna(df["LotFrontage"].median())
    df["Electrical"] = df["Electrical"].fillna(df["Electrical"].mode()[0])
    # Anything left (rare, scattered) gets a generic fallback.
    cat_cols = df.select_dtypes(include="object").columns
    df[cat_cols] = df[cat_cols].fillna("None")
    num_cols = df.select_dtypes(include=[np.number]).columns
    df[num_cols] = df[num_cols].fillna(0)
    return df


def build_features(df):
    y = np.log1p(df["SalePrice"].values)
    X = df.drop(columns=["Id", "SalePrice"])
    X = pd.get_dummies(X, drop_first=True)
    return X, y


def evaluate(name, model, X_train, y_train, X_holdout, y_holdout):
    model.fit(X_train, y_train)
    pred_log = model.predict(X_holdout)
    rmse_log = float(np.sqrt(mean_squared_error(y_holdout, pred_log)))
    r2 = float(r2_score(y_holdout, pred_log))
    mae_dollars = float(
        np.mean(np.abs(np.expm1(pred_log) - np.expm1(y_holdout)))
    )
    return {
        "model": name,
        "holdout_rmse_log_saleprice": round(rmse_log, 5),
        "holdout_r2": round(r2, 4),
        "holdout_mae_dollars": round(mae_dollars, 2),
    }, model


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    df = clean(load_data())
    X, y = build_features(df)
    X_train, X_holdout, y_train, y_holdout = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    cv = KFold(n_splits=10, shuffle=True, random_state=RANDOM_STATE)
    models = []

    ridge_pipe = Pipeline([("scale", StandardScaler()), ("ridge", Ridge())])
    ridge_cv = GridSearchCV(
        ridge_pipe,
        {"ridge__alpha": np.linspace(1, 500, 200)},
        cv=cv,
        scoring="neg_root_mean_squared_error",
    ).fit(X_train, y_train)
    ridge_result, _ = evaluate(
        "Ridge", ridge_cv.best_estimator_, X_train, y_train, X_holdout, y_holdout
    )
    ridge_result["best_alpha"] = round(float(ridge_cv.best_params_["ridge__alpha"]), 3)
    ridge_result["cv_rmse_log_saleprice"] = round(float(-ridge_cv.best_score_), 5)
    models.append(ridge_result)

    lasso_pipe = Pipeline(
        [("scale", StandardScaler()), ("lasso", Lasso(max_iter=50000))]
    )
    lasso_cv = GridSearchCV(
        lasso_pipe,
        {"lasso__alpha": np.logspace(-4, -1, 80)},
        cv=cv,
        scoring="neg_root_mean_squared_error",
    ).fit(X_train, y_train)
    lasso_result, lasso_best = evaluate(
        "Lasso", lasso_cv.best_estimator_, X_train, y_train, X_holdout, y_holdout
    )
    lasso_result["best_alpha"] = round(float(lasso_cv.best_params_["lasso__alpha"]), 5)
    lasso_result["cv_rmse_log_saleprice"] = round(float(-lasso_cv.best_score_), 5)
    lasso_coefs = lasso_best.named_steps["lasso"].coef_
    lasso_result["features_zeroed_out"] = int(np.sum(lasso_coefs == 0))
    lasso_result["features_total"] = int(len(lasso_coefs))
    models.append(lasso_result)

    rf = RandomForestRegressor(n_estimators=500, random_state=RANDOM_STATE, n_jobs=-1)
    rf_result, rf_fitted = evaluate("Random Forest", rf, X_train, y_train, X_holdout, y_holdout)
    importances = pd.Series(
        rf_fitted.feature_importances_, index=X_train.columns
    ).sort_values(ascending=False)
    top10 = importances.head(10)
    rf_result["top_10_features"] = [
        {"feature": f, "importance": round(float(v), 4)} for f, v in top10.items()
    ]
    models.append(rf_result)

    results = {
        "dataset": {
            "source": "Kaggle 'House Prices: Advanced Regression Techniques' "
            "(Ames Housing, De Cock 2011) — public competition dataset",
            "n_rows": int(len(df)),
            "n_features_after_one_hot_encoding": int(X.shape[1]),
            "train_rows": int(len(X_train)),
            "holdout_rows": int(len(X_holdout)),
            "target": "log1p(SalePrice)",
            "evaluation_note": "80/20 held-out split of the labeled training "
            "set (random_state=42), not the original Kaggle leaderboard "
            "score — no access to the unlabeled competition test set here.",
        },
        "models": models,
    }
    (OUTPUT_DIR / "results.json").write_text(json.dumps(results, indent=2))

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    names = [m["model"] for m in models]
    rmses = [m["holdout_rmse_log_saleprice"] for m in models]
    axes[0].bar(names, rmses, color=["#4C72B0", "#DD8452", "#55A868"])
    axes[0].set_ylabel("Holdout RMSE (log SalePrice)")
    axes[0].set_title("Model comparison — lower is better")
    for i, v in enumerate(rmses):
        axes[0].text(i, v, f"{v:.3f}", ha="center", va="bottom")

    top10_sorted = top10.sort_values()
    axes[1].barh(top10_sorted.index, top10_sorted.values, color="#55A868")
    axes[1].set_title("Random Forest — top 10 feature importances")
    axes[1].set_xlabel("Importance")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "chart.png", dpi=150)

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
