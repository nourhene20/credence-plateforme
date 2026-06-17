import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict

# ── Import unique et propre ───────────────────────────────────
from model_manager import manager, DEVICE, get_hidden_states
from registry import list_available

app = FastAPI(title="credence-application", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Label maps 

LABEL_MAPS = {
    "hatexplain":  {0: "hatespeech", 1: "normal",    2: "offensive"},
    "cebab":       {0: "negative",   1: "neutral",    2: "positive"},
    "goemotions":  {i: n for i, n in enumerate([
        "admiration","amusement","anger","annoyance","approval",
        "caring","confusion","curiosity","desire","disappointment",
        "disapproval","disgust","embarrassment","excitement","fear",
        "gratitude","grief","joy","love","nervousness","optimism",
        "pride","realization","relief","remorse","sadness","surprise","neutral"
    ])},
    "tid8":  {0: "entailment", 1: "neutral", 2: "contradiction"},
    "snli":  {0: "entailment", 1: "neutral", 2: "contradiction"},
    "sst2":  {0: "negative",  1: "positive"},
    "imdb":  {0: "negative",  1: "positive"},
}

CONCEPT_NAMES = {
    "cebab":          ["food", "service", "ambiance", "noise"],
    "hatexplain":     ["has_target", "is_offensive"],
    "civil_comments": ["severe_toxicity", "obscene", "threat",
                       "insult", "identity_attack", "sexual_explicit"],
}

#format_response

def format_response(outputs: dict, dataset: str) -> dict:
    label_map     = LABEL_MAPS.get(dataset, {})
    concept_names = CONCEPT_NAMES.get(dataset, [])

    logits = outputs["logits"]
    probs  = torch.softmax(logits, dim=-1)[0].cpu().float().numpy()
    pred   = int(probs.argmax())

    if "label_disagreement" in outputs and outputs["label_disagreement"] is not None:
        epistemic = float(outputs["label_disagreement"][0].cpu())
    elif outputs.get("disagreement") is not None and outputs["disagreement"].numel() > 0:
        epistemic = float(outputs["disagreement"][0].mean().cpu())
    else:
        epistemic = 0.0

    if outputs.get("ambiguity") is not None and outputs["ambiguity"].numel() > 0:
        aleatoric = float(outputs["ambiguity"][0].mean().cpu())
    else:
        aleatoric = float(
            -np.sum(probs * np.log(probs + 1e-8)) / np.log(max(len(probs), 2))
        )

    probabilities = {
        label_map.get(i, str(i)): float(p)
        for i, p in enumerate(probs)
    }

    heads_predictions: Dict[str, Dict[str, float]] = {}

    if concept_names:
        for i, head_prob in enumerate(outputs.get("head_probs", [])):
            hp = head_prob[0].cpu().float().numpy()
            heads_predictions[f"head_{i+1}"] = {
                concept_names[j]: float(hp[j])
                for j in range(min(len(concept_names), len(hp)))
            }
    else:
        for i, head_prob in enumerate(outputs.get("head_probs", [])):
            hp = head_prob[0].cpu().float().numpy()
            heads_predictions[f"head_{i+1}"] = {
                label_map.get(j, str(j)): float(hp[j])
                for j in range(len(hp))
            }

    result = {
        "prediction":        label_map.get(pred, str(pred)),
        "confidence":        float(probs[pred]),
        "epistemic":         epistemic,
        "aleatoric":         aleatoric,
        "probabilities":     probabilities,
        "heads_predictions": heads_predictions,
    }

    if concept_names and outputs.get("concept_probs") is not None:
        cp = outputs["concept_probs"][0].cpu().float().numpy()
        ep = outputs["disagreement"][0].cpu().float().numpy() \
             if outputs.get("disagreement") is not None \
             and outputs["disagreement"].numel() > 0 \
             else np.zeros(len(concept_names))
        al = outputs["ambiguity"][0].cpu().float().numpy() \
             if outputs.get("ambiguity") is not None \
             and outputs["ambiguity"].numel() > 0 \
             else np.zeros(len(concept_names))

        n = min(len(concept_names), len(cp))
        result["concepts"]              = {concept_names[i]: float(cp[i]) for i in range(n)}
        result["concept_uncertainties"] = {concept_names[i]: float(ep[i]) for i in range(n)}
        result["aleatoric_by_concept"]  = {concept_names[i]: float(al[i]) for i in range(n)}

    return result



class PredictRequest(BaseModel):
    text:    str
    encoder: str = "roberta-base"
    dataset: str = "hatexplain"
    n_heads: int = 5

class PredictResponse(BaseModel):
    prediction:            str
    confidence:            float
    epistemic:             float
    aleatoric:             float
    probabilities:         Optional[Dict[str, float]] = None
    heads_predictions:     Optional[Dict[str, Dict[str, float]]] = None
    concepts:              Optional[Dict[str, float]] = None
    concept_uncertainties: Optional[Dict[str, float]] = None
    aleatoric_by_concept:  Optional[Dict[str, float]] = None

# Endpoints 

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    try:
        encoder, tokenizer, hidden_size, model_type = manager.get_encoder(request.encoder)
        model = manager.get_model(request.encoder, request.dataset, request.n_heads)

        inputs = tokenizer(
            request.text,
            return_tensors = "pt",
            truncation     = True,
            max_length     = 128,
            padding        = "max_length",
        )

        input_ids      = inputs["input_ids"].to(DEVICE)
        attention_mask = inputs["attention_mask"].to(DEVICE)

        with torch.no_grad():
            if "modernbert" in request.encoder.lower():
                outputs = encoder(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    output_hidden_states=True,
                    return_dict=True
                )
                hidden_states = outputs.hidden_states[-1]
            else:
                hidden_states = get_hidden_states(
                    encoder, input_ids, attention_mask, model_type
                )
            
            outputs = model(hidden_states, attention_mask)
        return format_response(outputs, request.dataset)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/available")
async def available(encoder: str = None, dataset: str = None):
    return list_available(encoder, dataset)


@app.get("/health")
async def health():
    return {"status": "ok", "device": str(DEVICE)}


@app.get("/debug/registry")
async def debug_registry():
    from registry import REGISTRY
    return {
        "total": len(REGISTRY),
        "keys": [
            {"encoder": e, "dataset": d, "n_heads": n}
            for (e, d, n) in REGISTRY.keys()
        ]
    }


if __name__ == "__main__":
    import uvicorn
    print("Démarrage du serveur...")
    print("Device:", DEVICE)
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)