from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
from models_db import Task, Model, Dataset, DatasetClass, DatasetConcept, ModelDatasetCheckpoint

router = APIRouter(prefix="/data", tags=["Data"])

@router.get("/all")
def get_all_data(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    models = db.query(Model).all()
    datasets = db.query(Dataset).all()
    checkpoints = db.query(ModelDatasetCheckpoint).all()
    
    return {
        "tasks": [
            {
                "task_id": t.task_id,
                "name": t.name,
                "icon": t.icon
            }
            for t in tasks
        ],
        "models": [
            {
                "model_id": m.model_id,
                "name": m.name,
                "description": m.description,
                "params": m.params,
                "speed": m.speed,
                "type": m.type,
                "hugging_face_id": m.hugging_face_id
            }
            for m in models
        ],
        "datasets": [
            {
                "dataset_id": d.dataset_id,
                "name": d.name,
                "description": d.description,
                "icon": d.icon,
                "num_classes": d.num_classes,
                "has_concepts": d.has_concepts,
                "task_id": d.task_id,
                "classes": [
                    {"label_index": c.label_index, "label_name": c.label_name}
                    for c in sorted(d.classes, key=lambda x: x.label_index)
                ],
                "concepts": [
                    {"concept_index": c.concept_index, "concept_name": c.concept_name}
                    for c in sorted(d.concepts, key=lambda x: x.concept_index)
                ]
            }
            for d in datasets
        ],
        "checkpoints": [
            {
                "checkpoint_id": c.checkpoint_id,
                "model_id": c.model_id,
                "dataset_id": c.dataset_id,
                "n_heads": c.n_heads,
                "repo_id": c.repo_id
            }
            for c in checkpoints
        ]
    }




@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()

@router.get("/tasks/{task_id}")
def get_task_by_id(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task




@router.get("/models")
def get_models(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, description="Filtrer par type: 'encoder' ou 'llm'")
):
    query = db.query(Model)
    if type:
        query = query.filter(Model.type == type)
    return query.all()





@router.get("/datasets")
def get_datasets(
    db: Session = Depends(get_db),
    task_id: Optional[int] = Query(None, description="Filtrer par task_id")
):
    query = db.query(Dataset)
    if task_id:
        query = query.filter(Dataset.task_id == task_id)
    return query.all()

@router.get("/datasets/{dataset_id}/classes")
def get_dataset_classes(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return sorted(dataset.classes, key=lambda x: x.label_index)

@router.get("/datasets/{dataset_id}/concepts")
def get_dataset_concepts(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return sorted(dataset.concepts, key=lambda x: x.concept_index)

@router.get("/datasets/by-task/{task_id}")
def get_datasets_by_task(
    task_id: int,
    db: Session = Depends(get_db)
):

    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    datasets = db.query(Dataset).filter(Dataset.task_id == task_id).all()
    result = {}
    for d in datasets:
        classes = [c.label_name for c in sorted(d.classes, key=lambda x: x.label_index)]
        concepts = [c.concept_name for c in sorted(d.concepts, key=lambda x: x.concept_index)]
        
        key = d.name.lower().replace(" ", "_").replace("-", "")
        
        result[key] = {
            "name": d.name,
            "description": d.description,
            "icon": d.icon,
            "num_classes": d.num_classes,
            "class_names": classes,
            "has_concepts": d.has_concepts,
            "concept_names": concepts,
            "task_id": d.task_id,
            "dataset_id": d.dataset_id
        }
    
    return {
        "task_id": task_id,
        "task_name": task.name,
        "datasets": result,
        "count": len(result)
    }



@router.get("/checkpoints")
def get_checkpoints(db: Session = Depends(get_db)):
    return db.query(ModelDatasetCheckpoint).all()

@router.get("/available-heads")
def get_available_heads(
    encoder: str = Query(..., description="Hugging Face ID du modèle"),
    dataset: str = Query(..., description="Nom du dataset"),
    db: Session = Depends(get_db)
):
    model = db.query(Model).filter(Model.hugging_face_id == encoder).first()
    if not model:
        return {"heads": []}
    
    dataset_obj = db.query(Dataset).filter(Dataset.name.ilike(dataset)).first()
    if not dataset_obj:
        return {"heads": []}
    
    checkpoints = db.query(ModelDatasetCheckpoint).filter(
        ModelDatasetCheckpoint.model_id == model.model_id,
        ModelDatasetCheckpoint.dataset_id == dataset_obj.dataset_id
    ).all()
    
    heads = sorted([c.n_heads for c in checkpoints])
    return {"heads": heads}