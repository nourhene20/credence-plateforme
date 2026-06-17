from dataclasses import dataclass

@dataclass
class CheckpointInfo:
    repo_id:  str
    filename: str = "credence_checkpoint.pt"


REGISTRY: dict[tuple, CheckpointInfo] = {

    # ── ModernBERT ───────────────────────────────────────────────
    ("answerdotai/ModernBERT-base", "hatexplain", 5): CheckpointInfo(
        repo_id="tankiit/credence-ablation-modernbert-n-heads-5-hatexplain"
    ),
    ("answerdotai/ModernBERT-base", "hatexplain", 7): CheckpointInfo(
        repo_id="tankiit/credence-ablation-modernbert-n-heads-7-hatexplain"
    ),

    # ── DeBERTa-v3 ───────────────────────────────────────────────
    ("microsoft/deberta-v3-base", "hatexplain", 3): CheckpointInfo(
        repo_id="tankiit/credence-ablation-deberta-v3-n-heads-3-hatexplain"
    ),
    ("microsoft/deberta-v3-base", "hatexplain", 5): CheckpointInfo(
        repo_id="tankiit/credence-ablation-deberta-v3-n-heads-5-hatexplain"
    ),
    ("microsoft/deberta-v3-base", "hatexplain", 7): CheckpointInfo(
        repo_id="tankiit/credence-ablation-deberta-v3-n-heads-7-hatexplain"
    ),
    ("microsoft/deberta-v3-base", "hatexplain", 10): CheckpointInfo(
        repo_id="tankiit/credence-ablation-deberta-v3-n-heads-10-hatexplain"
    ),
    ("microsoft/deberta-v3-base", "hatexplain", 15): CheckpointInfo(
        repo_id="tankiit/credence-ablation-deberta-v3-n-heads-15-hatexplain"
    ),

    # ── RoBERTa — ablation n_heads ───────────────────────────────
    ("roberta-base", "hatexplain", 1): CheckpointInfo(
        repo_id="tankiit/credence-ablation-roberta-n-heads-1-hatexplain"
    ),
    ("roberta-base", "hatexplain", 3): CheckpointInfo(
        repo_id="tankiit/credence-ablation-roberta-n-heads-3-hatexplain"
    ),
    ("roberta-base", "hatexplain", 7): CheckpointInfo(
        repo_id="tankiit/credence-ablation-roberta-n-heads-7-hatexplain"
    ),
    ("roberta-base", "hatexplain", 10): CheckpointInfo(
        repo_id="tankiit/credence-ablation-roberta-n-heads-10-hatexplain"
    ),
    ("roberta-base", "hatexplain", 15): CheckpointInfo(
        repo_id="tankiit/credence-ablation-roberta-n-heads-15-hatexplain"
    ),

    # ── RoBERTa — datasets ───────────────────────────────────────
    ("roberta-base", "cebab",      5): CheckpointInfo(
        repo_id="tankiit/credence-roberta-20251223-143102-cebab"
    ),
    ("roberta-base", "goemotions", 5): CheckpointInfo(
        repo_id="tankiit/credence-roberta-20251223-143102-goemotions"
    ),
    ("roberta-base", "hatexplain", 5): CheckpointInfo(
        repo_id="tankiit/credence-roberta-20251223-143102-hatexplain"
    ),

    # ── Phi-3 — datasets ─────────────────────────────────────────
    ("microsoft/phi-3-mini-4k-instruct", "cebab", 5): CheckpointInfo(
        repo_id="tankiit/credence-phi-3-mini-4k-instruct-20251224-231117-cebab"
    ),
    ("microsoft/phi-3-mini-4k-instruct", "hatexplain", 5): CheckpointInfo(
        repo_id="tankiit/credence-phi-3-mini-4k-instruct-20251231-152117-hatexplain"
    ),
    ("microsoft/phi-3-mini-4k-instruct", "cebab", 5): CheckpointInfo(
        repo_id="tankiit/credence-phi-3-mini-4k-instruct-20251231-152729-cebab"
    ),
    ("microsoft/phi-3-mini-4k-instruct", "goemotions", 5): CheckpointInfo(
        repo_id="tankiit/credence-phi-3-mini-4k-instruct-20251231-152729-goemotions"
    ),
    ("microsoft/phi-3-mini-4k-instruct", "hatexplain", 5): CheckpointInfo(
        repo_id="tankiit/credence-phi-3-mini-4k-instruct-20251231-152729-hatexplain"
    ),
}


def get_checkpoint(encoder: str, dataset: str, n_heads: int = 5) -> CheckpointInfo:
    key = (encoder, dataset, n_heads)
    if key not in REGISTRY:
        raise ValueError(
            f"Pas de checkpoint pour ({encoder}, {dataset}, n_heads={n_heads})\n"
            f"Disponibles : {[k for k in REGISTRY if k[0]==encoder and k[1]==dataset]}"
        )
    return REGISTRY[key]


def list_available(encoder: str = None, dataset: str = None) -> list:
    return [
        {"encoder": e, "dataset": d, "n_heads": n}
        for (e, d, n) in REGISTRY
        if (encoder is None or e == encoder)
        and (dataset is None or d == dataset)
    ]