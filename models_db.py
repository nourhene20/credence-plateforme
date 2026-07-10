from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base



class Task(Base):
    __tablename__ = "task"
    task_id = Column(Integer, primary_key=True)
    name = Column(String(100))
    icon = Column(String(50))
    
    datasets = relationship("Dataset", back_populates="task")

class Model(Base):
    __tablename__ = "model"
    model_id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(Text)
    params = Column(String(20))
    speed = Column(String(20))
    type = Column(String(20))
    hugging_face_id = Column(String(100))
    
    checkpoints = relationship("ModelDatasetCheckpoint", back_populates="model")

class Dataset(Base):
    __tablename__ = "dataset"
    dataset_id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(Text)
    icon = Column(String(50))
    num_classes = Column(Integer)
    has_concepts = Column(Boolean)
    task_id = Column(Integer, ForeignKey("task.task_id"))
    
    task = relationship("Task", back_populates="datasets")
    classes = relationship("DatasetClass", back_populates="dataset")
    concepts = relationship("DatasetConcept", back_populates="dataset")
    checkpoints = relationship("ModelDatasetCheckpoint", back_populates="dataset")

class DatasetClass(Base):
    __tablename__ = "dataset_class"
    class_id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("dataset.dataset_id"))
    label_index = Column(Integer)
    label_name = Column(String(50))
    
    dataset = relationship("Dataset", back_populates="classes")

class DatasetConcept(Base):
    __tablename__ = "dataset_concept"
    concept_id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("dataset.dataset_id"))
    concept_index = Column(Integer)
    concept_name = Column(String(50))
    
    dataset = relationship("Dataset", back_populates="concepts")

class ModelDatasetCheckpoint(Base):
    __tablename__ = "model_dataset_checkpoint"
    checkpoint_id = Column(Integer, primary_key=True)
    model_id = Column(Integer, ForeignKey("model.model_id"))
    dataset_id = Column(Integer, ForeignKey("dataset.dataset_id"))
    n_heads = Column(Integer, default=5)
    repo_id = Column(Text)
    
    model = relationship("Model", back_populates="checkpoints")
    dataset = relationship("Dataset", back_populates="checkpoints")
    analyses = relationship("Analyse", back_populates="checkpoint")

class Analyse(Base):
    __tablename__ = "analyses"

    analyse_id = Column(Integer, primary_key=True)
    input_text = Column(Text)
    mode = Column(String(50))
    threshold_epi = Column(Float)
    threshold_ale = Column(Float)
    routing_decision = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

    checkpoint_id = Column(
        Integer,
        ForeignKey("model_dataset_checkpoint.checkpoint_id")
    )

    checkpoint = relationship(
        "ModelDatasetCheckpoint",
        back_populates="analyses"
    )

    predictions = relationship(
        "Prediction",
        back_populates="analyse",
        cascade="all, delete-orphan"
    )
class Prediction(Base):
    __tablename__ = "prediction"

    prediction_id = Column(Integer, primary_key=True)

    prediction_label = Column(String(100))
    confidence = Column(Float)

    epistemic = Column(Float)
    aleatoric = Column(Float)

    created_at = Column(DateTime, server_default=func.now())

    analyse_id = Column(
        Integer,
        ForeignKey("analyses.analyse_id")
    )

    analyse = relationship(
        "Analyse",
        back_populates="predictions"
    )

    class_probs = relationship(
        "PredictionClassProb",
        back_populates="prediction",
        cascade="all, delete-orphan"
    )

    concepts = relationship(
        "PredictionConcept",
        back_populates="prediction",
        cascade="all, delete-orphan"
    )

    heads = relationship(
        "PredictionHead",
        back_populates="prediction",
        cascade="all, delete-orphan"
    )
class PredictionClassProb(Base):
    __tablename__ = "prediction_class_prob"

    prob_id = Column(Integer, primary_key=True)

    prediction_id = Column(
        Integer,
        ForeignKey("prediction.prediction_id")
    )

    label_name = Column(String(100))
    probability = Column(Float)

    prediction = relationship(
        "Prediction",
        back_populates="class_probs"
    )
class PredictionConcept(Base):
    __tablename__ = "prediction_concept"

    concept_id = Column(Integer, primary_key=True)

    prediction_id = Column(
        Integer,
        ForeignKey("prediction.prediction_id")
    )

    concept_name = Column(String(100))

    value = Column(Float)
    epistemic = Column(Float)
    aleatoric = Column(Float)

    prediction = relationship(
        "Prediction",
        back_populates="concepts"
    )
class PredictionHead(Base):
    __tablename__ = "prediction_head"

    head_id = Column(Integer, primary_key=True)

    prediction_id = Column(
        Integer,
        ForeignKey("prediction.prediction_id")
    )

    head_index = Column(Integer)

    label_name = Column(String(100))
    concept_name = Column(String(100))

    value = Column(Float)

    prediction = relationship(
        "Prediction",
        back_populates="heads"
    )