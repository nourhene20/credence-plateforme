# **Analyse Interface**
 
The main analysis screen: submit text, pick a model and dataset, and inspect the resulting prediction and uncertainty breakdown.
 
## **Purpose**
 
`TextSubmissionInterfaceComponent` is where users actually run the CREDENCE model. It lets them choose an encoder or LLM, a compatible dataset, and a checkpoint (by head count), then submits text and visualizes confidence, epistemic/aleatoric uncertainty, and — when available — concept-level and per-head breakdowns.
 
## **Configuration Flow**
 
1. On load, models/datasets/tasks are pulled from `AdminService`'s cached config (`loadConfig()`), split into encoder vs. LLM lists.
2. Selecting a model type, model, or dataset re-triggers `loadAvailableHeads()`, which asks the backend which head counts have a trained checkpoint for that model+dataset pair. If none exist, a warning is shown and submission is effectively blocked.
3. Datasets can be filtered by task via quick-filter buttons, backed by `GET /data/datasets/by-task/{task_id}`.
## **Submission & Routing**
 
| Step | Description |
|---|---|
| Input | Free text (single mode) or a `.txt` file (batch mode, drag-and-drop) |
| Format check | NLI-type datasets (task `nli`) require `premise [SEP] hypothesis`; validated client-side before submitting |
| Predict | `CredenceService.predict()` calls the model backend with text, model, dataset, and head count |
| Save | Every result is persisted via `POST /analyse/save` (feeds the History module) |
| Routing decision | Computed client-side from two adjustable thresholds — see below |
 
### Routing logic
 
```
EU = epistemic uncertainty, AU = aleatoric uncertainty
 
low EU, low AU  → TRUST    (model confident, input clear)
high EU, low AU → DATA     (model confused, but input is clear)
low EU, high AU → REVIEW   (model confident, but humans may disagree)
high EU, high AU→ ABSTAIN  (model confused, input unclear)
```
 
Both thresholds (`thresholdEpi`, `thresholdAle`) are adjustable via sliders and recompute routing for every point already plotted, without a new API call.
 
## **Visualizations** 
 
| Chart | Shown when | Purpose |
|---|---|---|
| Scatter plot | Always, once ≥1 result exists | EU vs AU for every submission this session, colored by routing decision, with threshold guide lines |
| Concept histogram | Dataset has concepts | EU and AU per concept |
| EU vs Accuracy curve | Dataset has concepts | Relationship between a concept's uncertainty and its predicted value |
| Per-head concept chart | Dataset has concepts + heads | Each attention head's prediction per concept |
| Class probability bar chart | NLI-style dataset | Entailment / Neutral / Contradiction distribution |
| Per-head NLI chart | NLI-style dataset + heads | Each head's prediction per NLI class |
 

 
