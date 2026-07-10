import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
import numpy as np
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
from sqlalchemy.orm import Session

from model_manager import manager, DEVICE, get_hidden_states
from routes_config import router as config_router
from routes_analyse import router as analyse_router
from routes_admin import router as admin_router
from database import get_db
from models_db import ModelDatasetCheckpoint, Model, Dataset, DatasetClass, DatasetConcept

app = FastAPI(title="CREDENCE API", version="1.0.0")
app.include_router(config_router)
app.include_router(analyse_router)
app.include_router(admin_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




def get_label_map_from_db(dataset_name: str, db: Session) -> Dict[int, str]:
    """Récupère les labels d'un dataset depuis la base."""
    dataset = db.query(Dataset).filter(Dataset.name.ilike(dataset_name)).first()
    if not dataset:
        return {}
    
    classes = db.query(DatasetClass).filter(
        DatasetClass.dataset_id == dataset.dataset_id
    ).order_by(DatasetClass.label_index).all()
    
    return {c.label_index: c.label_name for c in classes}


def get_concept_names_from_db(dataset_name: str, db: Session) -> List[str]:
    """Récupère les concepts d'un dataset depuis la base."""
    dataset = db.query(Dataset).filter(Dataset.name.ilike(dataset_name)).first()
    if not dataset:
        return []
    
    concepts = db.query(DatasetConcept).filter(
        DatasetConcept.dataset_id == dataset.dataset_id
    ).order_by(DatasetConcept.concept_index).all()
    
    return [c.concept_name for c in concepts]




def format_response(outputs: dict, dataset: str, db: Session) -> dict:
    """Formate la réponse en utilisant les données de la base."""
    
    label_map = get_label_map_from_db(dataset, db)
    concept_names = get_concept_names_from_db(dataset, db)
    
    if not label_map:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset}' non trouvé ou sans classes"
        )
    
    logits = outputs["logits"]
    probs = torch.softmax(logits, dim=-1)[0].cpu().float().numpy()
    pred = int(probs.argmax())

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
        "prediction": label_map.get(pred, str(pred)),
        "confidence": float(probs[pred]),
        "epistemic": epistemic,
        "aleatoric": aleatoric,
        "probabilities": probabilities,
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
        result["concepts"] = {concept_names[i]: float(cp[i]) for i in range(n)}
        result["concept_uncertainties"] = {concept_names[i]: float(ep[i]) for i in range(n)}
        result["aleatoric_by_concept"] = {concept_names[i]: float(al[i]) for i in range(n)}

    return result




class PredictRequest(BaseModel):
    text: str
    encoder: str
    dataset: str
    n_heads: int = 5


class PredictResponse(BaseModel):
    prediction: str
    confidence: float
    epistemic: float
    aleatoric: float
    probabilities: Optional[Dict[str, float]] = None
    heads_predictions: Optional[Dict[str, Dict[str, float]]] = None
    concepts: Optional[Dict[str, float]] = None
    concept_uncertainties: Optional[Dict[str, float]] = None
    aleatoric_by_concept: Optional[Dict[str, float]] = None



@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest, db: Session = Depends(get_db)):
    try:
        encoder, tokenizer, hidden_size, model_type = manager.get_encoder(request.encoder)
        model = manager.get_model(request.encoder, request.dataset, request.n_heads)

        inputs = tokenizer(
            request.text,
            return_tensors="pt",
            truncation=True,
            max_length=128,
            padding="max_length",
        )

        input_ids = inputs["input_ids"].to(DEVICE)
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
            
            model_outputs = model(hidden_states, attention_mask)
        
        return format_response(model_outputs, request.dataset, db)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/available")
async def available(
    encoder: Optional[str] = None,
    dataset: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ModelDatasetCheckpoint)
    
    if encoder:
        model = db.query(Model).filter(Model.hugging_face_id == encoder).first()
        if model:
            query = query.filter(ModelDatasetCheckpoint.model_id == model.model_id)
        else:
            return []
    
    if dataset:
        dataset_obj = db.query(Dataset).filter(Dataset.name.ilike(dataset)).first()
        if dataset_obj:
            query = query.filter(ModelDatasetCheckpoint.dataset_id == dataset_obj.dataset_id)
        else:
            return []
    
    checkpoints = query.all()
    
    result = []
    for c in checkpoints:
        if c.model and c.dataset:
            result.append({
                "encoder": c.model.hugging_face_id,
                "dataset": c.dataset.name.lower().replace(" ", "_"),
                "n_heads": c.n_heads,
            })
    
    return result




@app.get("/health")
async def health():
    return {"status": "ok", "device": str(DEVICE)}




@app.get("/debug/registry")
async def debug_registry(db: Session = Depends(get_db)):
    checkpoints = db.query(ModelDatasetCheckpoint).all()
    return {
        "total": len(checkpoints),
        "keys": [
            {
                "encoder": c.model.hugging_face_id if c.model else None,
                "dataset": c.dataset.name if c.dataset else None,
                "n_heads": c.n_heads,
                "repo_id": c.repo_id
            }
            for c in checkpoints
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)