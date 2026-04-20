import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type MyjobWorkflowStatus = 'in-progress' | 'in-review' | 'completed';

export interface MyjobDeliveryFile {
  fileName: string;
  fileData: string;
  mimeType?: string;
}

export interface MyjobActiveProjectCard {
  id?: string;
  proposalId?: string;
  projectId?: string;
  title: string;
  orderId: string;
  timeLabel?: string;
  status: string;
  statusClass: string;
  workflowStatus: MyjobWorkflowStatus;
  clientName?: string;
  freelancerName?: string;
  helperText?: string;
  progressPercent?: number;
  progressBarClass?: string;
  actionLabel?: string;
  actionIcon?: string;
  actionDisabled?: boolean;
  projectBudget?: number;
  projectDeadlineDays?: number;
  pitch?: string;
  duration?: string;
  attachmentFileName?: string;
  attachmentFileData?: string;
  deliveryMessage?: string;
  deliveryFiles?: MyjobDeliveryFile[];
  deliverySubmittedAtLabel?: string;
  latestRequestedAmount?: number;
  latestPaymentType?: 'paid' | 'unpaid';
  latestDeliveryIsNew?: boolean;
}

@Component({
  selector: 'app-myjob-active-project-card',
  templateUrl: './myjob-active-project-card.component.html',
  styleUrls: ['./myjob-active-project-card.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class MyjobActiveProjectCardComponent {
  @Input({ required: true }) project!: MyjobActiveProjectCard;
  @Output() select = new EventEmitter<void>();
  @Output() action = new EventEmitter<void>();

  onSelect(): void {
    this.select.emit();
  }

  onAction(event: Event): void {
    event.stopPropagation();

    if (this.project.actionDisabled) {
      return;
    }

    this.action.emit();
  }
}
