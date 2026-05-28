from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import os
import hashlib
from transformers import AutoTokenizer, AutoModel
from huggingface_hub import hf_hub_download

app = FastAPI(title="CREDENCE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Device: {device}")

CHECKPOINT_DIR = "./checkpoints"
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

#Cebab model 
class ConceptHead(nn.Module):
    def __init__(self, input_dim=768, hidden_dim=256, n_concepts=4, dropout=0.1, pooling="cls"):
        super().__init__()
        self.pooling = pooling
        self.dropout = nn.Dropout(dropout)
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, n_concepts)

    def pool(self, hidden_states, attention_mask):
        if self.pooling == "cls":
            return hidden_states[:, 0, :]
        mask = attention_mask.unsqueeze(-1).float()
        return (hidden_states * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)

    def forward(self, hidden_states, attention_mask):
        x = self.pool(hidden_states, attention_mask)
        x = self.dropout(x)
        x = F.relu(self.fc1(x))
        return torch.sigmoid(self.fc2(x))

class AleatoricHead(nn.Module):
    def __init__(self, input_dim=768, hidden_dim=256, n_concepts=4, pooling="cls"):
        super().__init__()
        self.pooling = pooling
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, n_concepts)
        )

    def pool(self, hidden_states, attention_mask):
        if self.pooling == "cls":
            return hidden_states[:, 0, :]
        mask = attention_mask.unsqueeze(-1).float()
        return (hidden_states * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)

    def forward(self, hidden_states, attention_mask):
        return torch.sigmoid(self.net(self.pool(hidden_states, attention_mask)))

class ConceptClassifier(nn.Module):
    def __init__(self, n_concepts=4, n_classes=2):
        super().__init__()
        self.W = nn.Parameter(torch.randn(n_classes, n_concepts) * 0.05)
        self.b = nn.Parameter(torch.zeros(n_classes))

    def forward(self, x):
        return x @ self.W.T + self.b

class CREDENCE_CEBaB(nn.Module):
    def __init__(self, n_heads=5, n_concepts=4, n_classes=2, input_dim=768):
        super().__init__()
        dropouts = [0.05, 0.11, 0.18, 0.25, 0.30]
        poolings = ["cls", "mean", "cls", "mean", "cls"]
        
        self.heads = nn.ModuleList([
            ConceptHead(input_dim=input_dim, dropout=dropouts[i], pooling=poolings[i], n_concepts=n_concepts)
            for i in range(n_heads)
        ])
        self.aleatoric_head = AleatoricHead(input_dim=input_dim, pooling="cls", n_concepts=n_concepts)
        self.classifier = ConceptClassifier(n_concepts, n_classes)

    def forward(self, hidden_states, attention_mask):
        all_probs = torch.stack([head(hidden_states, attention_mask) for head in self.heads], dim=-1)
        concept_probs = all_probs.mean(dim=-1)
        epistemic = all_probs.var(dim=-1)
        aleatoric = self.aleatoric_head(hidden_states, attention_mask)
        logits = self.classifier(concept_probs)
        return {
            'logits': logits,
            'concept_probs': concept_probs,
            'epistemic': epistemic,
            'aleatoric': aleatoric,
            'all_heads_probs': all_probs
        }


#Snli model
class CREDENCE_SNLI(nn.Module):
    def __init__(self, n_heads=5, input_dim=3072, n_classes=3):
        super().__init__()
        dropouts = [0.05, 0.11, 0.18, 0.25, 0.30]
        self.heads = nn.ModuleList([
            nn.Sequential(
                nn.Linear(input_dim, 256),
                nn.ReLU(),
                nn.Dropout(dropouts[i]),
                nn.Linear(256, n_classes)
            )
            for i in range(n_heads)
        ])

    def forward(self, hidden_states):
       
        for m in self.modules():
            if isinstance(m, nn.Dropout):
                m.train()

        all_logits = torch.stack(
            [head(hidden_states) for head in self.heads], dim=-1
        )  
        all_probs    = torch.softmax(all_logits, dim=1)
        mean_logits  = all_logits.mean(dim=-1)
        epistemic    = all_probs.var(dim=-1).mean(dim=-1)

        return {
            'logits':          mean_logits,
            'epistemic':       epistemic,
            'all_heads_probs': all_probs,
        }

#loading models

print("\nChargement CEBaB...")
cebab_path = os.path.join(CHECKPOINT_DIR, "cebab_best_model.pt")
if not os.path.exists(cebab_path):
    cebab_path = hf_hub_download(
        repo_id="nourhene20/credence-model",
        filename="cebab_best_model.pt",
        local_dir=CHECKPOINT_DIR,
    )

checkpoint_cebab = torch.load(cebab_path, map_location=device)
config_cebab = checkpoint_cebab.get('config', {})
n_heads_cebab = config_cebab.get('n_heads', 5)
n_concepts_cebab = config_cebab.get('num_concepts', 4)
n_classes_cebab = config_cebab.get('num_classes', 2)
best_acc_cebab = checkpoint_cebab.get('best_val_acc', 0)

model_cebab = CREDENCE_CEBaB(
    n_heads=n_heads_cebab,
    n_concepts=n_concepts_cebab,
    n_classes=n_classes_cebab,
    input_dim=768
).to(device)
model_cebab.load_state_dict(checkpoint_cebab['model_state_dict'], strict=False)
model_cebab.eval()
print(f"CEBaB chargé (acc: {best_acc_cebab:.2%})")

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

encoder = AutoModel.from_pretrained("distilbert-base-uncased").to(device)
encoder.eval()
for param in encoder.parameters():
    param.requires_grad = False
print("DistilBERT chargé")

print("\nChargement SNLI...")
snli_path = os.path.join(CHECKPOINT_DIR, "snli_best_model.pt")
if not os.path.exists(snli_path):
    snli_path = hf_hub_download(
        repo_id="nourhene20/credence-model",
        filename="snli_best_model.pt",
        local_dir=CHECKPOINT_DIR,
    )

checkpoint_snli = torch.load(snli_path, map_location=device)
n_heads_snli = 5
n_classes_snli = 3
best_acc_snli = checkpoint_snli.get('best_val_acc', 0)

model_snli = CREDENCE_SNLI(
    n_heads=n_heads_snli,
    input_dim=3072,
    n_classes=n_classes_snli
).to(device)
model_snli.load_state_dict(checkpoint_snli['model_state_dict'], strict=False)
model_snli.eval()
print(f"SNLI chargé (acc: {best_acc_snli:.2%})")

snli_cache_path = os.path.join(CHECKPOINT_DIR, "test.pt")
snli_hidden = None
if os.path.exists(snli_cache_path):
    data = torch.load(snli_cache_path, map_location="cpu")
    snli_hidden = data["hidden_states"]
    print(f"Cache SNLI: {len(snli_hidden)} samples")
else:
    print(f"⚠️ Cache SNLI non trouvé")

_text_hash_cache = {}

label_map_cebab = {0: "POSITIVE", 1: "NEGATIVE"}
label_map_snli = {0: "ENTAILMENT", 1: "NEUTRAL", 2: "CONTRADICTION"}
concept_names = ['food', 'service', 'ambiance', 'noise']



def predict_cebab(text: str) -> dict:
    inputs = tokenizer(text, return_tensors='pt', truncation=True, max_length=128, padding='max_length')
    input_ids = inputs['input_ids'].to(device)
    attention_mask = inputs['attention_mask'].to(device)
    
    with torch.no_grad():
        hidden_states = encoder(input_ids, attention_mask=attention_mask).last_hidden_state
        outputs = model_cebab(hidden_states, attention_mask)
        
        logits = outputs['logits']
        probs = torch.softmax(logits, dim=-1)
        prediction = logits.argmax(dim=-1).item()
        concept_probs = outputs['concept_probs'][0].cpu().numpy()
        epistemic = outputs['epistemic'][0].cpu().numpy()
        aleatoric = outputs['aleatoric'][0].cpu().numpy()
        
        all_heads = outputs['all_heads_probs'][0].cpu().numpy()
        heads_predictions = {}
        for i in range(n_heads_cebab):
            heads_predictions[f"head_{i+1}"] = {
                concept_names[j]: float(all_heads[j, i]) for j in range(n_concepts_cebab)
            }
    
    return {
        "prediction": label_map_cebab.get(prediction, "NEUTRAL"),
        "confidence": float(probs[0][prediction].cpu()),
        "epistemic": float(epistemic.mean()),
        "aleatoric": float(aleatoric.mean()),
        "aleatoric_by_concept": {concept_names[i]: float(aleatoric[i]) for i in range(n_concepts_cebab)},
        "concepts": {concept_names[i]: float(concept_probs[i]) for i in range(n_concepts_cebab)},
        "concept_uncertainties": {concept_names[i]: float(epistemic[i]) for i in range(n_concepts_cebab)},
        "heads_predictions": heads_predictions
    }

def predict_snli(text: str) -> dict:
    if snli_hidden is None:
        raise HTTPException(status_code=500, detail="Cache SNLI non disponible")

    text_hash = hashlib.md5(text.encode()).hexdigest()
    if text_hash not in _text_hash_cache:
        _text_hash_cache[text_hash] = abs(hash(text_hash)) % len(snli_hidden)
    idx = _text_hash_cache[text_hash]

    hs = snli_hidden[idx:idx+1].to(device)

    N_PASSES = 10
    all_epistemics = []
    all_probs_list = []

    for _ in range(N_PASSES):
        with torch.no_grad():
            outputs = model_snli(hs)
            all_epistemics.append(outputs['epistemic'].item())
            all_probs_list.append(
                torch.softmax(outputs['logits'], dim=-1)[0].cpu().numpy()
            )

    epistemic = float(np.mean(all_epistemics))
    mean_probs = np.mean(all_probs_list, axis=0)
    prediction = int(mean_probs.argmax())

    
    entropie = -np.sum(mean_probs * np.log(mean_probs + 1e-8))
    aleatoric = float(entropie / np.log(3))
    all_heads_np = outputs['all_heads_probs'][0].cpu().numpy()
    heads_predictions = {}
    for i in range(n_heads_snli):
        heads_predictions[f"head_{i+1}"] = {
            "entailment":    float(all_heads_np[0, i]),
            "neutral":       float(all_heads_np[1, i]),
            "contradiction": float(all_heads_np[2, i]),
        }

    return {
        "prediction":  label_map_snli[prediction],
        "confidence":  float(mean_probs[prediction]),
        "epistemic":   epistemic,
        "aleatoric":   aleatoric,
        "probabilities": {
            "entailment":    float(mean_probs[0]),
            "neutral":       float(mean_probs[1]),
            "contradiction": float(mean_probs[2]),
        },
        "heads_predictions": heads_predictions,
    }

#request/response 

class PredictRequest(BaseModel):
    text: str
    dataset: str = "cebab"  # "cebab" ou "snli"

class PredictResponse(BaseModel):
    prediction: str
    confidence: float
    epistemic: float
    aleatoric: float
    aleatoric_by_concept: Optional[Dict[str, float]] = None
    concepts: Optional[Dict[str, float]] = None
    concept_uncertainties: Optional[Dict[str, float]] = None
    heads_predictions: Optional[Dict[str, Dict[str, float]]] = None
    probabilities: Optional[Dict[str, float]] = None

#endpoints

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    try:
        if request.dataset == "snli":
            result = predict_snli(request.text)
        else:
            result = predict_cebab(request.text)
        return PredictResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "device": str(device),
        "models": {
            "cebab": {"loaded": True, "val_acc": best_acc_cebab},
            "snli": {"loaded": snli_hidden is not None, "val_acc": best_acc_snli}
        }
    }

@app.get("/info")
async def info():
    return {
        "cebab": {
            "classes": 2,
            "concepts": concept_names,
            "label_map": label_map_cebab,
            "n_heads": n_heads_cebab
        },
        "snli": {
            "classes": 3,
            "labels": list(label_map_snli.values()),
            "n_heads": n_heads_snli,
            "cache_size": len(snli_hidden) if snli_hidden else 0
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)