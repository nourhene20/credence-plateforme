"""from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models_db import Task, Model, Dataset, ModelDatasetCheckpoint
from typing import Optional, List

router = APIRouter(prefix="/config", tags=["Configuration"])

@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
   
    tasks = db.query(Task).all()
    result = {}
    for t in tasks:
        key = t.name.lower().replace(" ", "_")
        if key == "natural_language_inference":
            key = "nli"
        elif key == "toxicity_detection":
            key = "toxicity"
        elif key == "emotion_recognition":
            key = "emotion"
        elif key == "sentiment_analysis":
            key = "sentiment"
            
        result[key] = {
            "name": t.name,
            "icon": t.icon,
            "task_id": t.task_id
        }
    return result


@router.get("/tasks/{task_id}")
def get_task_by_id(task_id: int, db: Session = Depends(get_db)):
   
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        return {"error": "Task not found"}
    return {
        "task_id": task.task_id,
        "name": task.name,
        "icon": task.icon
    }


@router.get("/models")
def get_models(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, description="Filtrer par type: 'encoder' ou 'llm'")
):
   
    query = db.query(Model)
    
    if type is not None and isinstance(type, str):
        query = query.filter(Model.type == type)
    
    models = query.all()
    result = {}
    for m in models:
        result[m.hugging_face_id] = {
            "name": m.name,
            "description": m.description,
            "params": m.params,
            "speed": m.speed,
            "type": m.type,
            "hugging_face_id": m.hugging_face_id,
            "model_id": m.model_id
        }
    return result


@router.get("/models/type/{model_type}")
def get_models_by_type(
    model_type: str,
    db: Session = Depends(get_db)
):
   
    if model_type not in ["encoder", "llm"]:
        return {"error": "Type must be 'encoder' or 'llm'"}
    
    models = db.query(Model).filter(Model.type == model_type).all()
    result = {}
    for m in models:
        result[m.hugging_face_id] = {
            "name": m.name,
            "description": m.description,
            "params": m.params,
            "speed": m.speed,
            "type": m.type,
            "hugging_face_id": m.hugging_face_id,
            "model_id": m.model_id
        }
    return result


@router.get("/models/{model_id}")
def get_model_by_id(model_id: int, db: Session = Depends(get_db)):
   
    model = db.query(Model).filter(Model.model_id == model_id).first()
    if not model:
        return {"error": "Model not found"}
    return {
        "model_id": model.model_id,
        "name": model.name,
        "description": model.description,
        "params": model.params,
        "speed": model.speed,
        "type": model.type,
        "hugging_face_id": model.hugging_face_id
    }


@router.get("/models/hf/{hugging_face_id}")
def get_model_by_hf_id(
    hugging_face_id: str,
    db: Session = Depends(get_db)
):
   
    model = db.query(Model).filter(Model.hugging_face_id == hugging_face_id).first()
    if not model:
        return {"error": "Model not found"}
    return {
        "model_id": model.model_id,
        "name": model.name,
        "description": model.description,
        "params": model.params,
        "speed": model.speed,
        "type": model.type,
        "hugging_face_id": model.hugging_face_id
    }


@router.get("/datasets")
def get_datasets(
    db: Session = Depends(get_db),
    task_id: Optional[int] = Query(None, description="Filtrer par task_id")
):
    
    query = db.query(Dataset)
    
    if task_id is not None and isinstance(task_id, int):
        query = query.filter(Dataset.task_id == task_id)
    
    datasets = query.all()
    result = {}
    for d in datasets:
        classes = [c.label_name for c in sorted(d.classes, key=lambda x: x.label_index)]
        concepts = [c.concept_name for c in sorted(d.concepts, key=lambda x: x.concept_index)]
        
        key = d.name.lower().replace(" ", "_").replace("-", "")
        
        task_name = d.task.name if d.task else ""
        task_key = task_name.lower().replace(" ", "_")
        if task_key == "natural_language_inference":
            task_key = "nli"
        elif task_key == "toxicity_detection":
            task_key = "toxicity"
        elif task_key == "emotion_recognition":
            task_key = "emotion"
        elif task_key == "sentiment_analysis":
            task_key = "sentiment"
        
        result[key] = {
            "name": d.name,
            "description": d.description,
            "icon": d.icon,
            "num_classes": d.num_classes,
            "class_names": classes,
            "has_concepts": d.has_concepts,
            "concept_names": concepts,
            "task": task_key,
            "task_id": d.task_id,
            "dataset_id": d.dataset_id
        }
    return result


@router.get("/datasets/task/{task_id}")
def get_datasets_by_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    
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
    return result


@router.get("/datasets/{dataset_id}")
def get_dataset_by_id(dataset_id: int, db: Session = Depends(get_db)):
    
    dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not dataset:
        return {"error": "Dataset not found"}
    
    classes = [c.label_name for c in sorted(dataset.classes, key=lambda x: x.label_index)]
    concepts = [c.concept_name for c in sorted(dataset.concepts, key=lambda x: x.concept_index)]
    
    return {
        "dataset_id": dataset.dataset_id,
        "name": dataset.name,
        "description": dataset.description,
        "icon": dataset.icon,
        "num_classes": dataset.num_classes,
        "has_concepts": dataset.has_concepts,
        "class_names": classes,
        "concept_names": concepts,
        "task_id": dataset.task_id
    }


@router.get("/datasets/{dataset_id}/classes")
def get_dataset_classes(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    
    dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not dataset:
        return {"error": "Dataset not found"}
    
    return [
        {
            "label_index": c.label_index,
            "label_name": c.label_name
        }
        for c in sorted(dataset.classes, key=lambda x: x.label_index)
    ]


@router.get("/datasets/{dataset_id}/concepts")
def get_dataset_concepts(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    
    dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not dataset:
        return {"error": "Dataset not found"}
    
    return [
        {
            "concept_index": c.concept_index,
            "concept_name": c.concept_name
        }
        for c in sorted(dataset.concepts, key=lambda x: x.concept_index)
    ]


@router.get("/all")
def get_all_config(db: Session = Depends(get_db)):
   
    return {
        "tasks": get_tasks(db=db),
        "models": get_models(db=db),
        "datasets": get_datasets(db=db),
    }



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

@router.get("/available/model/{model_id}")
def get_available_combinations_by_model(
    model_id: int,
    db: Session = Depends(get_db)
):
    
    checkpoints = db.query(ModelDatasetCheckpoint).filter(
        ModelDatasetCheckpoint.model_id == model_id
    ).all()
    result = []
    for c in checkpoints:
        if c.model and c.dataset:
            result.append({
                "encoder": c.model.hugging_face_id,
                "dataset": c.dataset.name.lower().replace(" ", "_"),
                "n_heads": c.n_heads,
            })
    return result


@router.get("/available/dataset/{dataset_id}")
def get_available_combinations_by_dataset(
    dataset_id: int,
    db: Session = Depends(get_db)
):
   
    checkpoints = db.query(ModelDatasetCheckpoint).filter(
        ModelDatasetCheckpoint.dataset_id == dataset_id
    ).all()
    result = []
    for c in checkpoints:
        if c.model and c.dataset:
            result.append({
                "encoder": c.model.hugging_face_id,
                "dataset": c.dataset.name.lower().replace(" ", "_"),
                "n_heads": c.n_heads,
            })
    return result


@router.get("/stats")
def get_config_stats(db: Session = Depends(get_db)):
    
    return {
        "total_tasks": db.query(Task).count(),
        "total_models": db.query(Model).count(),
        "total_datasets": db.query(Dataset).count(),
        "total_checkpoints": db.query(ModelDatasetCheckpoint).count(),
        "models_by_type": {
            "encoder": db.query(Model).filter(Model.type == "encoder").count(),
            "llm": db.query(Model).filter(Model.type == "llm").count(),
        }
    }

@router.get("/datasets/{dataset_id}/classes")
def get_dataset_classes(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    
    classes = db.query(DatasetClass).filter(
        DatasetClass.dataset_id == dataset_id
    ).order_by(DatasetClass.label_index).all()
    
    return {
        "dataset_id": dataset_id,
        "classes": [
            {
                "index": c.label_index,
                "name": c.label_name
            }
            for c in classes
        ]
    }

@router.get("/datasets/{dataset_id}/concepts")
def get_dataset_concepts(
    dataset_id: int,
    db: Session = Depends(get_db)
):
   
    concepts = db.query(DatasetConcept).filter(
        DatasetConcept.dataset_id == dataset_id
    ).order_by(DatasetConcept.concept_index).all()
    
    return {
        "dataset_id": dataset_id,
        "concepts": [
            {
                "index": c.concept_index,
                "name": c.concept_name
            }
            for c in concepts
        ]
    }


@router.get("/all")
def get_all_config(db: Session = Depends(get_db)):
    
    tasks = get_tasks(db)
    models = get_models(db)
    datasets = get_datasets(db)
    
    for dataset_key, dataset_info in datasets.items():
        dataset_id = dataset_info.get("dataset_id")
        if dataset_id:
            
            classes = db.query(DatasetClass).filter(
                DatasetClass.dataset_id == dataset_id
            ).order_by(DatasetClass.label_index).all()
            dataset_info["class_names"] = [c.label_name for c in classes]
            
           
            concepts = db.query(DatasetConcept).filter(
                DatasetConcept.dataset_id == dataset_id
            ).order_by(DatasetConcept.concept_index).all()
            dataset_info["concept_names"] = [c.concept_name for c in concepts]
    
    return {
        "tasks": tasks,
        "models": models,
        "datasets": datasets,
    }"""