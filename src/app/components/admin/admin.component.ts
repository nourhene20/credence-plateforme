import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { AdminService} from '../../services/admin.service';
import { Task, Model, Dataset, Checkpoint } from '../../shared/models_interfaces';
import { ConfirmDeleteComponent } from '../confirm-delete/confirm-delete.component';


export const ALL_EMOJIS = [
  '😊', '😂', '🤣', '❤️', '💕', '😍', '🥰', '😘', '😎', '🤓', '😢', '😭', '😤', '😠', '😡', '🤬', '💢', '💥',
  '🎉', '🎊', '🎈', '🎁', '🎀', '💝', '💖', '💗', '💓', '💞', '💘', '💌', '💟', '🌟', '✨', '⭐',
  '🍽️', '🍕', '🍔', '🌮', '🍣', '🍩', '🍪', '☕', '🍺', '🥂', '🍷', '🍸', '🍹', '🍰', '🎂', '🧁',
  '🎬', '🎥', '📽️', '🎞️', '📺', '📱', '💻', '🖥️', '⌨️', '🖱️', '💾', '📀', '💿', '📡', '📷', '🎙️',
  '🚀', '🌍', '🌎', '🌏', '🌈', '⭐', '🌙', '☀️', '🔥', '💧', '🌊', '🌺', '🌸', '🌹', '🌻', '🌿',
  '⚠️', '🚨', '🛑', '✅', '❌', '⭕', '🔄', '🔁', '🔂', '▶️', '⏸️', '⏹️', '⏺️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣',
  '🎵', '🎶', '🎧', '🎤', '🎹', '🎸', '🥁', '🎺', '🎻', '🎨', '🎭', '🎪', '🎯', '🎮', '🎲', '🎳',
  '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '💯', '🔢', '🔣',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎',
  '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪',
  '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽',
  '⛪', '🕌', '🕍', '⛩️', '🕋', '⛲', '🏛️'
];

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  private pendingDelete: (() => void) | null = null;
  isLoadingDetails: boolean = false;
  selectedDatasetDetails: any = null;
  allEmojis = ALL_EMOJIS;
  showEmojiPicker: string | null = null;
  activeTab: 'tasks' | 'models' | 'datasets' | 'checkpoints' = 'tasks';
  tasks: Task[] = [];
  models: Model[] = [];
  datasets: Dataset[] = [];
  checkpoints: Checkpoint[] = [];
  isLoading = false;
  showAddForm = false;
  showEditForm = false;
  editingId: number | null = null;
  taskForm!: FormGroup;
  modelForm!: FormGroup;
  datasetForm!: FormGroup;
  checkpointForm!: FormGroup;
  speedOptions = ['fast', 'medium', 'slow'];
  typeOptions = ['encoder', 'llm'];
  @ViewChild('confirmDelete') confirmDeleteComponent!: ConfirmDeleteComponent;
  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {}
  
  ngOnInit() {
    this.initForms();
    this.loadAllData();
  }
  
  initForms() {
    this.taskForm = this.fb.group({
      name: ['', Validators.required],
      icon: ['', Validators.required]
    });
    
    this.modelForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      params: ['', Validators.required],
      speed: ['fast', Validators.required],
      type: ['encoder', Validators.required],
      hugging_face_id: ['', Validators.required]
    });
    
    this.datasetForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      icon: ['', Validators.required],
      num_classes: [1, [Validators.required, Validators.min(1)]],
      has_concepts: [false],
      num_concepts: [0, [Validators.min(0)]],
      task_id: [null, Validators.required],
      classes: this.fb.array([]),
      concepts: this.fb.array([])
    });
    
    this.checkpointForm = this.fb.group({
      model_id: [null, Validators.required],
      dataset_id: [null, Validators.required],
      n_heads: [5, [Validators.required, Validators.min(1)]],
      repo_id: ['', Validators.required]
    });
  }
  
  get classesArray(): FormArray {
    return this.datasetForm.get('classes') as FormArray;
  }
  
  get conceptsArray(): FormArray {
    return this.datasetForm.get('concepts') as FormArray;
  }
  
  generateClassFields() {
    const numClasses = this.datasetForm.get('num_classes')?.value || 0;
    this.classesArray.clear();
    for (let i = 0; i < numClasses; i++) {
      this.classesArray.push(
        this.fb.group({
          label_index: [i],
          label_name: ['', Validators.required]
        })
      );
    }
  }
  
  generateConceptFields() {
    const numConcepts = this.datasetForm.get('num_concepts')?.value || 0;
    this.conceptsArray.clear();
    for (let i = 0; i < numConcepts; i++) {
      this.conceptsArray.push(
        this.fb.group({
          concept_index: [i],
          concept_name: ['', Validators.required]
        })
      );
    }
  }
  toggleEmojiPicker(field: string) {
    this.showEmojiPicker = this.showEmojiPicker === field ? null : field;
  }
  
  closeEmojiPicker() {
    this.showEmojiPicker = null;
  }
  
  selectEmoji(emoji: string, field: string) {
    if (field === 'task') {
      this.taskForm.patchValue({ icon: emoji });
    } else if (field === 'dataset') {
      this.datasetForm.patchValue({ icon: emoji });
    }
    this.closeEmojiPicker();
  }
  loadAllData() {
    this.isLoading = true;
    this.adminService.getTasks().subscribe({
      next: (data) => { this.tasks = data; /*console.log(`${data.length} tâches chargées`);*/ },
      error: (err) => { /*console.error(' Erreur chargement tâches:', err);*/ this.tasks = []; }
    });
    
    this.adminService.getModels().subscribe({
      next: (data) => { this.models = data; /*console.log(` ${data.length} modèles chargés`)*/; },
      error: (err) => { /*console.error(' Erreur chargement modèles:', err); */this.models = []; }
    });
    
    this.adminService.getDatasets().subscribe({
      next: (data) => { this.datasets = data; console.log(` ${data.length} datasets chargés`); },
      error: (err) => { /*console.error(' Erreur chargement datasets:', err);*/ this.datasets = []; }
    });
    
    this.adminService.getCheckpoints().subscribe({
      next: (data) => { this.checkpoints = data; this.isLoading = false; /*console.log(` ${data.length} checkpoints chargés`); */},
      error: (err) => { /*console.error(' Erreur chargement checkpoints:', err);*/ this.checkpoints = []; this.isLoading = false; }
    });
  }
  
  setActiveTab(tab: 'tasks' | 'models' | 'datasets' | 'checkpoints') {
    this.activeTab = tab;
    this.showAddForm = false;
    this.showEditForm = false;
    this.editingId = null;
    this.closeEmojiPicker();
  }
  
  openAddForm() {
    this.showAddForm = true;
    this.showEditForm = false;
    this.editingId = null;
    this.closeEmojiPicker();
    this.classesArray.clear();
    this.conceptsArray.clear();
    this.datasetForm.patchValue({ num_concepts: 0 });
  }
  
  openEditForm(item: any, form: FormGroup, id: number) {
    this.editingId = id;
    this.showEditForm = true;
    this.showAddForm = false;
    form.patchValue(item);
    this.closeEmojiPicker();
  }
  
  resetCurrentForm() {
    this.taskForm.reset();
    this.modelForm.reset();
    this.datasetForm.reset();
    this.checkpointForm.reset();
    this.classesArray.clear();
    this.conceptsArray.clear();
    this.datasetForm.patchValue({ num_concepts: 0 });
  }

  addTask() {
    if (this.taskForm.invalid) return;
    this.adminService.createTask(this.taskForm.value).subscribe({
      next: () => { this.loadAllData(); this.taskForm.reset(); this.showAddForm = false; },
      error: (err) => {}/*console.error(' Erreur création tâche:', err)*/
    });
  }
  
  editTask(task: Task) {
    this.openEditForm(task, this.taskForm, task.task_id!);
  }
  
  updateTask() {
    if (this.taskForm.invalid || !this.editingId) return;
    this.adminService.updateTask(this.editingId, this.taskForm.value).subscribe({
      next: () => { this.loadAllData(); this.taskForm.reset(); this.showEditForm = false; this.editingId = null; },
      error: (err) =>{}/* console.error(' Erreur mise à jour tâche:', err)*/
    });
  }
  
 deleteTask(taskId: number) {
    const task = this.tasks.find(t => t.task_id === taskId);
    if (!task) return;

    this.confirmDeleteComponent.itemName = task.name;
    this.confirmDeleteComponent.itemType = 'task';
    this.confirmDeleteComponent.question = 'Are you sure you want to delete the task "{{ itemName }}"?';
    this.confirmDeleteComponent.message = 'This will permanently delete the task and all associated datasets and checkpoints.';
    this.confirmDeleteComponent.visible = true;

    this.pendingDelete = () => {
      this.adminService.deleteTask(taskId).subscribe({
        next: () => {
          this.loadAllData();
          //console.log(` Task "${task.name}" deleted`);
        },
        error: (err) =>{} /*console.error(' Error deleting task:', err)*/
      });
    };
  }
  
  addModel() {
    if (this.modelForm.invalid) return;
    this.adminService.createModel(this.modelForm.value).subscribe({
      next: () => { this.loadAllData(); this.modelForm.reset(); this.showAddForm = false; },
      error: (err) =>{} /*console.error(' Erreur création modèle:', err)*/
    });
  }
  
  editModel(model: Model) {
    this.openEditForm(model, this.modelForm, model.model_id!);
  }
  
  updateModel() {
    if (this.modelForm.invalid || !this.editingId) return;
    this.adminService.updateModel(this.editingId, this.modelForm.value).subscribe({
      next: () => { this.loadAllData(); this.modelForm.reset(); this.showEditForm = false; this.editingId = null; },
      error: (err) =>{} /*console.error(' Erreur mise à jour modèle:', err)*/
    });
  }
  
deleteModel(modelId: number) {
    const model = this.models.find(m => m.model_id === modelId);
    if (!model) return;

    this.confirmDeleteComponent.itemName = model.name;
    this.confirmDeleteComponent.itemType = 'model';
    this.confirmDeleteComponent.question = 'Are you sure you want to delete the model "{{ itemName }}"?';
    this.confirmDeleteComponent.message = ' This will permanently delete the model and all associated checkpoints.';
    this.confirmDeleteComponent.visible = true;

    this.pendingDelete = () => {
      this.adminService.deleteModel(modelId).subscribe({
        next: () => {
          this.loadAllData();
          //console.log(` Model "${model.name}" deleted`);
        },
        error: (err) => {}/*console.error(' Error deleting model:', err)*/
      });
    };
  }
  

  addDataset() {
  if (this.datasetForm.invalid) return;

  const payload = {
    name:         this.datasetForm.get('name')?.value,
    description:  this.datasetForm.get('description')?.value,
    icon:         this.datasetForm.get('icon')?.value,
    num_classes:  this.datasetForm.get('num_classes')?.value,
    has_concepts: this.datasetForm.get('has_concepts')?.value,
    task_id:      this.datasetForm.get('task_id')?.value,
    classes:      this.classesArray.value,   
    concepts:     this.conceptsArray.value,  
  };

  this.adminService.createDataset(payload as any).subscribe({
    next: (result) => {
      this.loadAllData();
      this.datasetForm.reset();
      this.classesArray.clear();
      this.conceptsArray.clear();
      this.datasetForm.patchValue({ num_concepts: 0 });
      this.showAddForm = false;
    },
    error: (err) => {}/*console.error(' Erreur création dataset:', err)*/
  });
}
  editDataset(dataset: Dataset) {
    this.openEditForm(dataset, this.datasetForm, dataset.dataset_id!);
  }
  
  updateDataset() {
    if (this.datasetForm.invalid || !this.editingId) return;
    
    const taskId = this.datasetForm.get('task_id')?.value;
    const task = this.tasks.find(t => t.task_id === taskId);
    
    const datasetData = {
      name: this.datasetForm.get('name')?.value,
      description: this.datasetForm.get('description')?.value,
      icon: this.datasetForm.get('icon')?.value,
      num_classes: this.datasetForm.get('num_classes')?.value,
      has_concepts: this.datasetForm.get('has_concepts')?.value,
      task_id: taskId,
      task_name: task?.name || ''
    };
    
    this.adminService.updateDataset(this.editingId, datasetData).subscribe({
      next: () => {
        this.loadAllData();
        this.datasetForm.reset();
        this.classesArray.clear();
        this.conceptsArray.clear();
        this.datasetForm.patchValue({ num_concepts: 0 });
        this.showEditForm = false;
        this.editingId = null;
      },
      error: (err) =>{}/* console.error(' Erreur mise à jour dataset:', err)*/
    });
  }
  
deleteDataset(datasetId: number) {
    const dataset = this.datasets.find(d => d.dataset_id === datasetId);
    if (!dataset) return;

    this.confirmDeleteComponent.itemName = dataset.name;
    this.confirmDeleteComponent.itemType = 'dataset';
    this.confirmDeleteComponent.question = 'Are you sure you want to delete the dataset "{{ itemName }}"?';
    this.confirmDeleteComponent.message = 'This will permanently delete the dataset and all associated classes, concepts, and checkpoints.';
    this.confirmDeleteComponent.visible = true;

    this.pendingDelete = () => {
      this.adminService.deleteDataset(datasetId).subscribe({
        next: () => {
          this.loadAllData();
          //console.log(` Dataset "${dataset.name}" deleted`);
        },
        error: (err) => {}/*console.error(' Error deleting dataset:', err)*/
      });
    };
  }

  
  addCheckpoint() {
    if (this.checkpointForm.invalid) return;
    this.adminService.createCheckpoint(this.checkpointForm.value).subscribe({
      next: () => { this.loadAllData(); this.checkpointForm.reset(); this.showAddForm = false; },
      error: (err) => {}/*console.error(' Erreur création checkpoint:', err)*/
    });
  }
  
  editCheckpoint(checkpoint: Checkpoint) {
    this.openEditForm(checkpoint, this.checkpointForm, checkpoint.checkpoint_id!);
  }
  
  updateCheckpoint() {
    if (this.checkpointForm.invalid || !this.editingId) return;
    this.adminService.updateCheckpoint(this.editingId, this.checkpointForm.value).subscribe({
      next: () => { this.loadAllData(); this.checkpointForm.reset(); this.showEditForm = false; this.editingId = null; },
      error: (err) => {}/*console.error(' Erreur mise à jour checkpoint:', err)*/
    });
  }
  
   deleteCheckpoint(checkpointId: number) {
    const checkpoint = this.checkpoints.find(cp => cp.checkpoint_id === checkpointId);
    if (!checkpoint) return;

    
    this.confirmDeleteComponent.itemType = 'checkpoint';
    this.confirmDeleteComponent.question = 'Are you sure you want to delete this checkpoint ?';
    this.confirmDeleteComponent.message = ' This will permanently delete the checkpoint.';
    this.confirmDeleteComponent.visible = true;

    this.pendingDelete = () => {
      this.adminService.deleteCheckpoint(checkpointId).subscribe({
        next: () => {
          this.loadAllData();
          /*console.log(` Checkpoint ${checkpointId} deleted`);*/
        },
        error: (err) => {}/*console.error(' Error deleting checkpoint:', err)*/
      });
    };
  }
  
  getModelName(modelId: number): string {
    const model = this.models.find(m => m.model_id === modelId);
    return model ? model.name : 'N/A';
  }
  
  getDatasetName(datasetId: number): string {
    const dataset = this.datasets.find(d => d.dataset_id === datasetId);
    return dataset ? dataset.name : 'N/A';
  }
  
  getTaskName(taskId: number): string {
    const task = this.tasks.find(t => t.task_id === taskId);
    return task ? task.name : 'N/A';
  }
  
  getSpeedIcon(speed: string): string {
    const icons: Record<string, string> = { fast: '⚡', medium: '📊', slow: '🐢' };
    return icons[speed] || '📊';
  }
openDatasetDetails(dataset: any) {
  if (dataset.classes && dataset.classes.length > 0 && 
      dataset.concepts && dataset.concepts.length > 0) {
    this.selectedDatasetDetails = {
      ...dataset,
      classes: dataset.classes || [],
      concepts: dataset.concepts || []
    };
    return;
  }
  this.isLoadingDetails = true;
  this.selectedDatasetDetails = {
    ...dataset,
    classes: [],
    concepts: [],
    loading: true
  };
  this.adminService.getDatasetClasses(dataset.dataset_id!).subscribe({
    next: (classes) => {
      this.selectedDatasetDetails = {
        ...this.selectedDatasetDetails,
        classes: classes || [],
        loading: false
      };
      //console.log(` ${classes.length} classes chargées pour ${dataset.name}`);
    },
    error: (err) => {
      //console.error(' Erreur chargement classes:', err);
      this.selectedDatasetDetails = {
        ...this.selectedDatasetDetails,
        classes: [],
        loading: false
      };
    }
  });
  this.adminService.getDatasetConcepts(dataset.dataset_id!).subscribe({
    next: (concepts) => {
      this.selectedDatasetDetails = {
        ...this.selectedDatasetDetails,
        concepts: concepts || [],
        loading: false
      };
      //console.log(` ${concepts.length} concepts chargés pour ${dataset.name}`);
    },
    error: (err) => {
      //console.error(' Erreur chargement concepts:', err);
      this.selectedDatasetDetails = {
        ...this.selectedDatasetDetails,
        concepts: [],
        loading: false
      };
    }
  });
}

  closeDatasetDetails() {
    this.selectedDatasetDetails = null;
  }
  onDeleteConfirmed() {
    if (this.pendingDelete) {
      this.pendingDelete();
      this.pendingDelete = null;
    }
  }

  onDeleteCanceled() {
    this.pendingDelete = null;
  }


}