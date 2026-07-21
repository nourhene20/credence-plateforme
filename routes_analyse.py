from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models_db import (
    Analyse, Prediction, PredictionClassProb, 
    PredictionConcept, PredictionHead, 
    ModelDatasetCheckpoint, Model, Dataset
)
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime


router = APIRouter(prefix="/analyse", tags=["Analyse"])


class SaveAnalyseRequest(BaseModel):
    text: str
    encoder: str
    dataset: str
    n_heads: int
    mode: str = "single"
    threshold_epi: float = 0.001481
    threshold_ale: float = 0.5522
    routing_decision: str
    prediction_label: str
    confidence: float
    epistemic: float
    aleatoric: float
    probabilities: Optional[Dict[str, float]] = None
    heads_predictions: Optional[Dict[str, Dict[str, float]]] = None
    concepts: Optional[Dict[str, float]] = None
    concept_uncertainties: Optional[Dict[str, float]] = None
    aleatoric_by_concept: Optional[Dict[str, float]] = None


@router.post("/save")
def save_analyse(request: SaveAnalyseRequest, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.hugging_face_id == request.encoder).first()
    dataset = db.query(Dataset).filter(Dataset.name.ilike(request.dataset)).first()
    
    if not model or not dataset:
        raise HTTPException(status_code=404, detail="Model or dataset not found")
    
    checkpoint = db.query(ModelDatasetCheckpoint).filter(
        ModelDatasetCheckpoint.model_id == model.model_id,
        ModelDatasetCheckpoint.dataset_id == dataset.dataset_id,
        ModelDatasetCheckpoint.n_heads == request.n_heads
    ).first()
    
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    
    analyse = Analyse(
        input_text=request.text,
        mode=request.mode,
        threshold_epi=request.threshold_epi,
        threshold_ale=request.threshold_ale,
        routing_decision=request.routing_decision,
        checkpoint_id=checkpoint.checkpoint_id
    )
    db.add(analyse)
    db.flush()
    
    prediction = Prediction(
        prediction_label=request.prediction_label,
        confidence=request.confidence,
        epistemic=request.epistemic,
        aleatoric=request.aleatoric,
        analyse_id=analyse.analyse_id
    )
    db.add(prediction)
    db.flush()
    
    if request.probabilities:
        for label, prob in request.probabilities.items():
            class_prob = PredictionClassProb(
                prediction_id=prediction.prediction_id,
                label_name=label,
                probability=prob
            )
            db.add(class_prob)
    
    if request.concepts:
        for concept_name, value in request.concepts.items():
            concept = PredictionConcept(
                prediction_id=prediction.prediction_id,
                concept_name=concept_name,
                value=value,
                epistemic=request.concept_uncertainties.get(concept_name, 0) if request.concept_uncertainties else 0,
                aleatoric=request.aleatoric_by_concept.get(concept_name, 0) if request.aleatoric_by_concept else 0
            )
            db.add(concept)
    
    if request.heads_predictions:
        for head_name, head_data in request.heads_predictions.items():
            head_idx = int(head_name.split("_")[1])
            for key, value in head_data.items():
                head = PredictionHead(
                    prediction_id=prediction.prediction_id,
                    head_index=head_idx,
                    concept_name=key if request.concepts else None,
                    label_name=key if not request.concepts else None,
                    value=value
                )
                db.add(head)
    
    db.commit()
    
    return {
        "status": "success",
        "analyse_id": analyse.analyse_id,
        "prediction_id": prediction.prediction_id
    }


@router.get("/history")
def get_history(
    limit: int = Query(50, description="Number of results per page"),
    offset: int = Query(0, description="Pagination offset"),
    search: Optional[str] = Query(None, description="Search in input text"),
    routing: Optional[str] = Query(None, description="Filter by routing decision"),
    model: Optional[str] = Query(None, description="Filter by model"),
    dataset: Optional[str] = Query(None, description="Filter by dataset"),
    date_from: Optional[datetime] = Query(None, description="Start date"),
    date_to: Optional[datetime] = Query(None, description="End date"),
    db: Session = Depends(get_db)
):  
    query = db.query(Analyse)
    
    if search:
        query = query.filter(Analyse.input_text.ilike(f"%{search}%"))
    
    if routing:
        query = query.filter(Analyse.routing_decision == routing)
    
    if model:
        query = query.join(ModelDatasetCheckpoint).join(Model).filter(
            Model.name.ilike(f"%{model}%")
        )
    
    if dataset:
        query = query.join(ModelDatasetCheckpoint).join(Dataset).filter(
            Dataset.name.ilike(f"%{dataset}%")
        )
    
    if date_from:
        query = query.filter(Analyse.created_at >= date_from)
    
    if date_to:
        query = query.filter(Analyse.created_at <= date_to)
    
    total = query.count()
    
    analyses = query.order_by(Analyse.created_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for a in analyses:
        pred = a.predictions[0] if a.predictions else None
        checkpoint = a.checkpoint
        
        result.append({
            "analyse_id": a.analyse_id,
            "input_text": a.input_text,
            "routing_decision": a.routing_decision,
            "created_at": a.created_at.isoformat(),
            "prediction": {
                "label": pred.prediction_label if pred else None,
                "confidence": pred.confidence if pred else None,
                "epistemic": pred.epistemic if pred else None,
                "aleatoric": pred.aleatoric if pred else None,
            } if pred else None,
            "model": checkpoint.model.name if checkpoint else None,
            "dataset": checkpoint.dataset.name if checkpoint else None,
            "n_heads": checkpoint.n_heads if checkpoint else None
        })
    
    return {
        "data": result,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/history/stats")
def get_history_stats(db: Session = Depends(get_db)):
    total = db.query(Analyse).count()
    
    trust = db.query(Analyse).filter(Analyse.routing_decision == "TRUST").count()
    data = db.query(Analyse).filter(Analyse.routing_decision == "DATA").count()
    review = db.query(Analyse).filter(Analyse.routing_decision == "REVIEW").count()
    abstain = db.query(Analyse).filter(Analyse.routing_decision == "ABSTAIN").count()
    
    avg_confidence = db.query(func.avg(Prediction.confidence)).scalar() or 0.0
    
    return {
        "total": total,
        "routing": {
            "TRUST": trust,
            "DATA": data,
            "REVIEW": review,
            "ABSTAIN": abstain
        },
        "avg_confidence": float(avg_confidence)
    }


@router.get("/history/{analyse_id}")
def get_analyse_detail(analyse_id: int, db: Session = Depends(get_db)):
    analyse = db.query(Analyse).filter(Analyse.analyse_id == analyse_id).first()
    
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse not found")
    
    pred = analyse.predictions[0] if analyse.predictions else None
    
    return {
        "analyse_id": analyse.analyse_id,
        "input_text": analyse.input_text,
        "mode": analyse.mode,
        "threshold_epi": analyse.threshold_epi,
        "threshold_ale": analyse.threshold_ale,
        "routing_decision": analyse.routing_decision,
        "created_at": analyse.created_at.isoformat(),
        "checkpoint": {
            "model": analyse.checkpoint.model.name if analyse.checkpoint else None,
            "dataset": analyse.checkpoint.dataset.name if analyse.checkpoint else None,
            "n_heads": analyse.checkpoint.n_heads if analyse.checkpoint else None,
        } if analyse.checkpoint else None,
        "prediction": {
            "label": pred.prediction_label if pred else None,
            "confidence": pred.confidence if pred else None,
            "epistemic": pred.epistemic if pred else None,
            "aleatoric": pred.aleatoric if pred else None,
            "class_probs": [
                {"label": cp.label_name, "probability": cp.probability}
                for cp in pred.class_probs
            ] if pred else [],
            "concepts": [
                {"name": c.concept_name, "value": c.value, "epistemic": c.epistemic, "aleatoric": c.aleatoric}
                for c in pred.concepts
            ] if pred else [],
            "heads": [
                {"head": h.head_index, "name": h.concept_name or h.label_name, "value": h.value}
                for h in pred.heads
            ] if pred else [],
        } if pred else None
    }