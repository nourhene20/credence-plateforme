from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from models_db import Task, Model, Dataset, DatasetClass, DatasetConcept, ModelDatasetCheckpoint

router = APIRouter(prefix="/admin", tags=["Administration"])


class TaskSchema(BaseModel):
    name: str
    icon: str

class ModelSchema(BaseModel):
    name: str
    description: str
    params: str
    speed: str
    type: str
    hugging_face_id: str

class ClassSchema(BaseModel):
    label_index: int
    label_name: str

class ConceptSchema(BaseModel):
    concept_index: int
    concept_name: str

class DatasetCreateSchema(BaseModel):
    name: str
    description: str
    icon: str
    num_classes: int
    has_concepts: bool
    task_id: int
    task_name: Optional[str] = None
    classes: List[ClassSchema] = []
    concepts: List[ConceptSchema] = []

class DatasetUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    num_classes: Optional[int] = None
    has_concepts: Optional[bool] = None
    task_id: Optional[int] = None

class CheckpointSchema(BaseModel):
    model_id: int
    dataset_id: int
    n_heads: int
    repo_id: str


@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()

@router.post("/tasks")
def create_task(task: TaskSchema, db: Session = Depends(get_db)):
    new_task = Task(name=task.name, icon=task.icon)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.put("/tasks/{task_id}")
def update_task(task_id: int, task: TaskSchema, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.task_id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db_task.name = task.name
    db_task.icon = task.icon
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.task_id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"message": "Deleted"}


@router.get("/models")
def get_models(db: Session = Depends(get_db)):
    return db.query(Model).all()

@router.post("/models")
def create_model(model: ModelSchema, db: Session = Depends(get_db)):
    new_model = Model(
        name=model.name,
        description=model.description,
        params=model.params,
        speed=model.speed,
        type=model.type,
        hugging_face_id=model.hugging_face_id,
    )
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    return new_model

@router.put("/models/{model_id}")
def update_model(model_id: int, model: ModelSchema, db: Session = Depends(get_db)):
    db_model = db.query(Model).filter(Model.model_id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    db_model.name            = model.name
    db_model.description     = model.description
    db_model.params          = model.params
    db_model.speed           = model.speed
    db_model.type            = model.type
    db_model.hugging_face_id = model.hugging_face_id
    db.commit()
    db.refresh(db_model)
    return db_model

@router.delete("/models/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db)):
    db_model = db.query(Model).filter(Model.model_id == model_id).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(db_model)
    db.commit()
    return {"message": "Deleted"}


@router.get("/datasets")
def get_datasets(db: Session = Depends(get_db)):
    datasets = db.query(Dataset).all()
    result = []
    for d in datasets:
        result.append({
            "dataset_id":   d.dataset_id,
            "name":         d.name,
            "description":  d.description,
            "icon":         d.icon,
            "num_classes":  d.num_classes,
            "has_concepts": d.has_concepts,
            "task_id":      d.task_id,
            "classes": [
                {"class_id": c.class_id, "label_index": c.label_index, "label_name": c.label_name}
                for c in sorted(d.classes, key=lambda x: x.label_index)
            ],
            "concepts": [
                {"concept_id": c.concept_id, "concept_index": c.concept_index, "concept_name": c.concept_name}
                for c in sorted(d.concepts, key=lambda x: x.concept_index)
            ],
        })
    return result

@router.post("/datasets")
def create_dataset(dataset: DatasetCreateSchema, db: Session = Depends(get_db)):
    """
    Crée le dataset + ses classes + ses concepts en une seule requête.
    """
    new_dataset = Dataset(
        name         = dataset.name,
        description  = dataset.description,
        icon         = dataset.icon,
        num_classes  = dataset.num_classes,
        has_concepts = dataset.has_concepts,
        task_id      = dataset.task_id,
    )
    db.add(new_dataset)
    db.flush() 

    for cls in dataset.classes:
        db.add(DatasetClass(
            dataset_id  = new_dataset.dataset_id,
            label_index = cls.label_index,
            label_name  = cls.label_name,
        ))

    if dataset.has_concepts:
        for concept in dataset.concepts:
            db.add(DatasetConcept(
                dataset_id    = new_dataset.dataset_id,
                concept_index = concept.concept_index,
                concept_name  = concept.concept_name,
            ))

    db.commit()
    db.refresh(new_dataset)

    return {
        "dataset_id":   new_dataset.dataset_id,
        "name":         new_dataset.name,
        "description":  new_dataset.description,
        "icon":         new_dataset.icon,
        "num_classes":  new_dataset.num_classes,
        "has_concepts": new_dataset.has_concepts,
        "task_id":      new_dataset.task_id,
        "classes_created":  len(dataset.classes),
        "concepts_created": len(dataset.concepts) if dataset.has_concepts else 0,
    }

@router.put("/datasets/{dataset_id}")
def update_dataset(dataset_id: int, dataset: DatasetUpdateSchema, db: Session = Depends(get_db)):
    db_dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.name is not None:         db_dataset.name         = dataset.name
    if dataset.description is not None:  db_dataset.description  = dataset.description
    if dataset.icon is not None:         db_dataset.icon         = dataset.icon
    if dataset.num_classes is not None:  db_dataset.num_classes  = dataset.num_classes
    if dataset.has_concepts is not None: db_dataset.has_concepts = dataset.has_concepts
    if dataset.task_id is not None:      db_dataset.task_id      = dataset.task_id
    db.commit()
    db.refresh(db_dataset)
    return db_dataset

@router.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    db_dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    db.delete(db_dataset)
    db.commit()
    return {"message": "Deleted"}

@router.get("/datasets/{dataset_id}/classes")
def get_classes(dataset_id: int, db: Session = Depends(get_db)):
    return db.query(DatasetClass).filter(DatasetClass.dataset_id == dataset_id).all()

@router.post("/datasets/{dataset_id}/classes")
def add_class(dataset_id: int, cls: ClassSchema, db: Session = Depends(get_db)):
    new_class = DatasetClass(
        dataset_id  = dataset_id,
        label_index = cls.label_index,
        label_name  = cls.label_name,
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class

@router.delete("/dataset-classes/{class_id}")
def delete_class(class_id: int, db: Session = Depends(get_db)):
    cls = db.query(DatasetClass).filter(DatasetClass.class_id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    db.delete(cls)
    db.commit()
    return {"message": "Deleted"}

@router.get("/datasets/{dataset_id}/concepts")
def get_concepts(dataset_id: int, db: Session = Depends(get_db)):
    return db.query(DatasetConcept).filter(DatasetConcept.dataset_id == dataset_id).all()

@router.post("/datasets/{dataset_id}/concepts")
def add_concept(dataset_id: int, concept: ConceptSchema, db: Session = Depends(get_db)):
    new_concept = DatasetConcept(
        dataset_id    = dataset_id,
        concept_index = concept.concept_index,
        concept_name  = concept.concept_name,
    )
    db.add(new_concept)
    db.commit()
    db.refresh(new_concept)
    return new_concept

@router.delete("/dataset-concepts/{concept_id}")
def delete_concept(concept_id: int, db: Session = Depends(get_db)):
    concept = db.query(DatasetConcept).filter(DatasetConcept.concept_id == concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")
    db.delete(concept)
    db.commit()
    return {"message": "Deleted"}


@router.get("/checkpoints")
def get_checkpoints(db: Session = Depends(get_db)):
    return db.query(ModelDatasetCheckpoint).all()

@router.post("/checkpoints")
def create_checkpoint(checkpoint: CheckpointSchema, db: Session = Depends(get_db)):
    new_cp = ModelDatasetCheckpoint(
        model_id   = checkpoint.model_id,
        dataset_id = checkpoint.dataset_id,
        n_heads    = checkpoint.n_heads,
        repo_id    = checkpoint.repo_id,
    )
    db.add(new_cp)
    db.commit()
    db.refresh(new_cp)
    return new_cp

@router.put("/checkpoints/{checkpoint_id}")
def update_checkpoint(checkpoint_id: int, checkpoint: CheckpointSchema, db: Session = Depends(get_db)):
    db_cp = db.query(ModelDatasetCheckpoint).filter(
        ModelDatasetCheckpoint.checkpoint_id == checkpoint_id
    ).first()
    if not db_cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    db_cp.model_id   = checkpoint.model_id
    db_cp.dataset_id = checkpoint.dataset_id
    db_cp.n_heads    = checkpoint.n_heads
    db_cp.repo_id    = checkpoint.repo_id
    db.commit()
    db.refresh(db_cp)
    return db_cp

@router.delete("/checkpoints/{checkpoint_id}")
def delete_checkpoint(checkpoint_id: int, db: Session = Depends(get_db)):
    db_cp = db.query(ModelDatasetCheckpoint).filter(
        ModelDatasetCheckpoint.checkpoint_id == checkpoint_id
    ).first()
    if not db_cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    db.delete(db_cp)
    db.commit()
    return {"message": "Deleted"}