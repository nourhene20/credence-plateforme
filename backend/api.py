from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
import os
from typing import Dict, List
from huggingface_hub import hf_hub_download  # SEUL AJOUT

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    prediction: str
    confidence: float
    epistemic: float
    aleatoric: float
    aleatoric_by_concept: Dict[str, float]
    concepts: Dict[str, float]
    concept_uncertainties: Dict[str, float]
    heads_predictions: Dict[str, Dict[str, float]]  

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

class CREDENCE(nn.Module):
    def __init__(self, n_heads=5, n_concepts=4, n_classes=2):
        super().__init__()
        dropouts = [0.05, 0.11, 0.18, 0.25, 0.30]
        poolings = ["cls", "mean", "cls", "mean", "cls"]
        self.heads = nn.ModuleList([
            ConceptHead(dropout=dropouts[i], pooling=poolings[i])
            for i in range(n_heads)
        ])
        self.aleatoric_head = AleatoricHead(pooling="cls")
        self.classifier = ConceptClassifier(n_concepts, n_classes)

    def forward(self, hidden_states, attention_mask):
        all_probs = torch.stack([
            head(hidden_states, attention_mask) for head in self.heads
        ], dim=-1)
        concept_probs = all_probs.mean(dim=-1)
        epistemic = all_probs.var(dim=-1)
        aleatoric = self.aleatoric_head(hidden_states, attention_mask)
        logits = self.classifier(concept_probs)
        return {
            'logits': logits,
            'concept_probs': concept_probs,
            'disagreement': epistemic,
            'aleatoric': aleatoric,
            'all_heads_probs': all_probs  
        }
    
# CHARGEMENT - TÉLÉCHARGEMENT DEPUIS HUGGING FACE

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Device: {device}")


os.makedirs("./checkpoints", exist_ok=True)

# Télécharger le modèle depuis Hugging Face
print("Téléchargement du modèle depuis Hugging Face...")
model_path = hf_hub_download(
    repo_id="nourhene20/credence-model",  
    filename="cebab_best_model.pt",
    local_dir="./checkpoints",
    local_dir_use_symlinks=False
)
print(f"Modèle téléchargé : {model_path}")


checkpoint_path = "./checkpoints/cebab_best_model.pt"
checkpoint = torch.load(checkpoint_path, map_location=device)

saved_config = checkpoint['config']
print(f"\n Configuration chargée depuis l'entraînement:")
print(f"   - n_heads: {saved_config.get('n_heads', 5)}")
print(f"   - n_concepts: {saved_config.get('num_concepts', 4)}")
print(f"   - n_classes: {saved_config.get('num_classes', 2)}")
print(f"   - dropout_min: {saved_config.get('dropout_min', 0.05)}")
print(f"   - dropout_max: {saved_config.get('dropout_max', 0.30)}")
print(f"   - Best val accuracy: {checkpoint['best_val_acc']:.4f}")

n_heads = saved_config.get('n_heads', 5)
n_concepts = saved_config.get('num_concepts', 4)
n_classes = saved_config.get('num_classes', 2)

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

encoder = AutoModel.from_pretrained("distilbert-base-uncased").to(device)
encoder.eval()
for param in encoder.parameters():
    param.requires_grad = False
print("DistilBERT chargé")

model = CREDENCE(
    n_heads=n_heads,
    n_concepts=n_concepts,
    n_classes=n_classes
).to(device)

model.load_state_dict(checkpoint['model_state_dict'])
model.eval()
print("Modèle CREDENCE chargé avec les poids entraînés")

concept_names = ['food', 'service', 'ambiance', 'noise']
label_map = {0: "NEGATIF", 1: "POSITIF"}

print(f"\nAPI CREDENCE prête!")
print(f" Performance: {checkpoint['best_val_acc']:.2%} accuracy sur validation")

# ENDPOINTS

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    inputs = tokenizer(
        request.text,
        truncation=True,
        max_length=128,
        padding='max_length',
        return_tensors='pt'
    )
    input_ids = inputs['input_ids'].to(device)
    attention_mask = inputs['attention_mask'].to(device)

    with torch.no_grad():
        hidden_states = encoder(input_ids, attention_mask=attention_mask).last_hidden_state
        outputs = model(hidden_states, attention_mask)

        logits = outputs['logits']
        probs = torch.softmax(logits, dim=-1)
        prediction = logits.argmax(dim=-1).item()
        concept_probs = outputs['concept_probs'][0].cpu().numpy()
        epistemic = outputs['disagreement'][0].cpu().numpy()
        aleatoric = outputs['aleatoric'][0].cpu().numpy()
        
        all_heads_probs = outputs['all_heads_probs'][0].cpu().numpy()  
        
        heads_predictions = {}
        for head_idx in range(n_heads):
            head_name = f"head_{head_idx+1}"
            heads_predictions[head_name] = {
                concept_names[i]: float(all_heads_probs[i, head_idx]) 
                for i in range(n_concepts)
            }

    return PredictResponse(
        prediction=label_map.get(prediction, "NEUTRE"),
        confidence=float(probs[0][prediction].cpu()),
        epistemic=float(epistemic.mean()),
        aleatoric=float(aleatoric.mean()),
        aleatoric_by_concept={
            "food": float(aleatoric[0]),
            "service": float(aleatoric[1]),
            "ambiance": float(aleatoric[2]),
            "noise": float(aleatoric[3])
        },
        concepts={concept_names[i]: float(concept_probs[i]) for i in range(4)},
        concept_uncertainties={concept_names[i]: float(epistemic[i]) for i in range(4)},
        heads_predictions=heads_predictions
    )

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "device": str(device),
        "val_acc": checkpoint['best_val_acc'],
        "config": {
            "n_heads": n_heads,
            "n_concepts": n_concepts,
            "epochs": saved_config.get('epochs', 40)
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)