import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-confirm-delete',
  templateUrl: './confirm-delete.component.html',
  styleUrls: ['./confirm-delete.component.scss']
})
export class ConfirmDeleteComponent {

  @Input() visible: boolean = false;
  @Input() itemName: string = '';
  @Input() itemType: 'task' | 'model' | 'dataset' | 'checkpoint' = 'dataset';
  @Input() title: string = ' Confirm Deletion';
  @Input() question: string = 'Are you sure you want to delete "{{ itemName }}"?';
  @Input() message: string = '';
  @Input() confirmText: string = '🗑️ Delete';
  @Input() cancelText: string = 'Cancel';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();



  get cascadeMessage(): string {
    return this.message ;
  }

  get formattedQuestion(): string {
    return this.question.replace('{{ itemName }}', this.itemName);
  }

  onConfirm() {
    this.confirm.emit();
    this.close();
  }

  close() {
    this.visible = false;
    this.cancel.emit();
  }
}