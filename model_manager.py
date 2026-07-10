import sys
import os
import importlib.util

_credence_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "credence_model", "credence.py"   
)
_spec = importlib.util.spec_from_file_location("credence_core", _credence_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["credence_core"] = _mod
_spec.loader.exec_module(_mod)

CREDENCE = _mod.CREDENCE
ExperimentConfig = _mod.ExperimentConfig
MODEL_REGISTRY = _mod.MODEL_REGISTRY
load_encoder_model = _mod.load_encoder_model
load_llm_model_frozen = _mod.load_llm_model_frozen
get_hidden_states = _mod.get_hidden_states

import torch
from huggingface_hub import hf_hub_download
from database import get_db
from models_db import ModelDatasetCheckpoint, Model, Dataset

CACHE_DIR = "./checkpoints"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


class ModelManager:
    def __init__(self):
        self._models = {}
        self._encoders = {}

    def get_model(self, encoder: str, dataset: str, n_heads: int = 5):
        key = (encoder, dataset, n_heads)
        if key not in self._models:
            self._models[key] = self._load_credence(encoder, dataset, n_heads)
        return self._models[key]

    def _load_credence(self, encoder: str, dataset: str, n_heads: int):
        db = next(get_db())
        
        model = db.query(Model).filter(Model.hugging_face_id == encoder).first()
        if not model:
            raise ValueError(f"Modèle non trouvé: {encoder}")
        
        dataset_obj = db.query(Dataset).filter(Dataset.name.ilike(dataset)).first()
        if not dataset_obj:
            raise ValueError(f"Dataset non trouvé: {dataset}")
        
        checkpoint = db.query(ModelDatasetCheckpoint).filter(
            ModelDatasetCheckpoint.model_id == model.model_id,
            ModelDatasetCheckpoint.dataset_id == dataset_obj.dataset_id,
            ModelDatasetCheckpoint.n_heads == n_heads
        ).first()
        
        if not checkpoint:
            raise ValueError(
                f"Pas de checkpoint pour ({encoder}, {dataset}, n_heads={n_heads})"
            )
        
        print(f"Chargement du checkpoint: {checkpoint.repo_id}")
        
        local_path = hf_hub_download(
            repo_id=checkpoint.repo_id,
            filename="credence_checkpoint.pt",
            local_dir=os.path.join(CACHE_DIR, checkpoint.repo_id.replace("/", "_")),
        )

        ckpt = torch.load(local_path, map_location="cpu", weights_only=False)
        config = ckpt.get("config", {})
        metadata = ckpt.get("metadata", {})

        hidden_size = (
            ckpt.get("hidden_size")
            or config.get("hidden_size")
            or MODEL_REGISTRY.get(encoder, {}).get("hidden_size")
        )

        if hidden_size is None:
            state = ckpt["model_state_dict"]
            for k, tensor in state.items():
                if ("fc1.weight" in k or "heads.0" in k) and "weight" in k:
                    hidden_size = tensor.shape[1]
                    break

        if hidden_size is None:
            raise ValueError(f"hidden_size not found for {checkpoint.repo_id}")

        valid_fields = ExperimentConfig.__dataclass_fields__.keys()
        exp_config = ExperimentConfig(**{
            k: v for k, v in config.items()
            if k in valid_fields
        })
        head_configs = exp_config.get_head_configs()
        model_type = config.get("model_type", "encoder")

        model = CREDENCE(
            input_dim=hidden_size,
            num_concepts=metadata.get("num_concepts", 0),
            num_classes=metadata.get("num_classes", 3),
            head_configs=head_configs,
            aleatoric_mode=config.get("aleatoric_mode", "entropy"),
            model_type=model_type,
        ).to(DEVICE)

        model.load_state_dict(ckpt["model_state_dict"], strict=False)
        model.eval()

        print(f" {checkpoint.repo_id} | n_heads={n_heads} | hidden_size={hidden_size}")

        return model

    def get_encoder(self, encoder_hf_id: str):
        if encoder_hf_id not in self._encoders:
            self._encoders[encoder_hf_id] = self._load_encoder(encoder_hf_id)
        return self._encoders[encoder_hf_id]

    def _load_encoder(self, encoder_hf_id: str):
        print(f"Chargement de l'encodeur: {encoder_hf_id}")

        model_info = MODEL_REGISTRY.get(encoder_hf_id, {})
        encoder_type = model_info.get("type", "encoder")
        exp_config = ExperimentConfig(encoder_name=encoder_hf_id)

        if encoder_type == "llm":
            enc, tok, hidden_size, mtype = load_llm_model_frozen(
                encoder_hf_id, DEVICE, exp_config
            )
        else:
            enc, tok, hidden_size, mtype = load_encoder_model(
                encoder_hf_id, DEVICE, freeze=True
            )

        if "deberta-v3" in encoder_hf_id.lower():
            from transformers import AutoTokenizer
            tok = AutoTokenizer.from_pretrained(encoder_hf_id, use_fast=False)
            print("  DeBERTa-v3: slow tokenizer loaded")

        print(f"Encodeur chargé: {encoder_hf_id} ({mtype}, hidden={hidden_size})")
        return enc, tok, hidden_size, mtype

    def get_model_type(self, encoder_hf_id: str) -> str:
        return MODEL_REGISTRY.get(encoder_hf_id, {}).get("type", "encoder")


manager = ModelManager()