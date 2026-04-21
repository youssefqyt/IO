import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  MyjobActiveProjectCard,
  MyjobActiveProjectCardComponent,
  MyjobDeliveryFile,
  MyjobWorkflowStatus
} from '../../components/myjob-active-project-card/myjob-active-project-card.component';

type UserRole = 'freelancer' | 'client';

interface StoredProfile {
  id?: string;
  fullName?: string;
  email?: string;
  role?: UserRole;
}

interface ProposalParty {
  id?: string;
  name?: string;
  email?: string;
  skills?: string[];
}

interface SendProposalRecord {
  id: string;
  projectId: string;
  clientId: string;
  freelancerId: string;
  projectTitle: string;
  projectBudget?: number;
  projectDeadlineDays?: number;
  pitch: string;
  bid: number;
  duration: string;
  milestonesEnabled: boolean;
  attachmentFileName?: string;
  attachmentFileData?: string;
  etat: string;
  status: string;
  createdAtLabel: string;
  client?: ProposalParty;
  freelancer?: ProposalParty;
}

interface SprintRecord {
  sprintId: string;
  sprintNumber: number;
  title: string;
  description: string;
  status: 'unpaid' | 'paid';
  price: number;
  deliveryMessage: string;
  deliveryFiles: MyjobDeliveryFile[];
  submittedAtLabel: string;
  paidAtLabel: string;
  submittedAt?: string;
  canAccessFiles: boolean;
}

interface ActiveMyjobRecord {
  id: string;
  proposalId: string;
  projectId: string;
  clientId: string;
  freelancerId: string;
  projectTitle: string;
  projectBudget?: number;
  projectDeadlineDays?: number;
  pitch: string;
  bid: number;
  duration: string;
  attachmentFileName?: string;
  attachmentFileData?: string;
  deliveryMessage?: string;
  deliveryFiles?: MyjobDeliveryFile[];
  deliverySubmittedAtLabel?: string;
  status: string;
  workflowStatus?: string;
  etat: string;
  acceptedAtLabel: string;
  client?: ProposalParty;
  freelancer?: ProposalParty;
  sprints: SprintRecord[];
  totalPaidAmount: number;
  remainingBudgetAmount: number;
  hasUnreadUpdate: boolean;
  lastCommunicationType: string;
  lastCommunicationAtLabel: string;
}

interface ProjectDetailsResponse {
  id: string;
  title: string;
  description: string;
  category?: string;
  projectType?: string;
  briefFileName?: string;
  briefFileData?: string;
}

interface WorkflowOption {
  value: MyjobWorkflowStatus;
  label: string;
}

interface WorkflowMeta {
  label: string;
  description: string;
  cardBadgeClass: string;
  progressPercent: number;
  progressBarClass: string;
  detailBadgeClass: string;
  dotClass: string;
  actionLabel: string;
  actionIcon: string;
  nextStatus?: MyjobWorkflowStatus;
}

interface TaskMilestone {
  title: string;
  state: 'done' | 'current' | 'pending';
}

interface DeliveryAssetsResponse {
  message: string;
  workflowStatus: string;
  deliveryMessage?: string;
  deliveryFiles?: MyjobDeliveryFile[];
  deliverySubmittedAtLabel?: string;
}

interface ReviewProjectContext {
  proposalId?: string;
  projectId?: string;
  projectTitle?: string;
  clientId?: string;
  freelancerId?: string;
}

@Component({
  selector: 'app-myjob',
  templateUrl: './myjob.component.html',
  styleUrls: ['./myjob.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule, MyjobActiveProjectCardComponent]
})
export class MyjobComponent implements OnInit {
  readonly apiUrl = environment.apiUrl;
  readonly maxDeliveryBytes = 8 * 1024 * 1024;
  readonly workflowOptions: WorkflowOption[] = [
    { value: 'in-progress', label: 'In Progress' },
    { value: 'in-review', label: 'In Review' },
  ];

  showSubmission = false;
  activeTab: 'active' | 'history' | 'drafts' = 'active';
  profile: StoredProfile | null = null;
  activeProjects: MyjobActiveProjectCard[] = [];
  isLoadingActiveProjects = false;
  activeProjectsError = '';
  draftProposals: SendProposalRecord[] = [];
  isLoadingDrafts = false;
  draftsError = '';
  actionMessage = '';
  processingProposalId = '';
  attachmentError = '';
  deliveryError = '';
  deliverySuccessMessage = '';
  deliveryMessage = '';
  deliveryPrice = 0;
  deliveryFiles: MyjobDeliveryFile[] = [];
  isReadingDeliveryFiles = false;
  isSubmittingDelivery = false;
  showFilePreview = false;
  safePreviewUrl: SafeResourceUrl | null = null;
  previewFileData: string | null = null;
  isPreviewPdf = false;
  isPreviewImage = false;
  previewTitle = '';
  selectedProject: MyjobActiveProjectCard | null = null;
  submissionProject: MyjobActiveProjectCard | null = null;
  isLoadingSelectedProject = false;
  isUpdatingProjectStatus = false;
  selectedProjectError = '';
  statusUpdateMessage = '';
  selectedProjectDescription = '';
  selectedProjectCategory = '';
  selectedProjectType = '';
  selectedProjectBriefFileName = '';
  selectedProjectBriefFileData = '';

  projectHistory: any[] = [];
  isLoadingHistory = false;
  historyError = '';

  showCompleteProjectDialog = false;
  isCompletingProject = false;
  completeProjectMessage = '';

  showPaymentModal = false;
  paymentSprint: SprintRecord | null = null;
  paymentError = '';
  paymentSuccessMessage = '';
  cardNumber = '4242 4242 4242 4242';
  expiryDate = '12/30';
  cvv = '123';
  isProcessingPayment = false;

  showRatingModal = false;
  reviewProject: ReviewProjectContext | null = null;
  reviewError = '';
  reviewSuccessMessage = '';
  reviewProfessionalism = 5;
  reviewQualityOfCode = 5;
  isSubmittingReview = false;

  constructor(
    private readonly location: Location,
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.profile = this.getStoredProfile();
    this.loadActiveProjects();
    this.loadDraftProposals();
  }

  ionViewWillEnter(): void {
    this.profile = this.getStoredProfile();
    this.loadActiveProjects();
    this.loadDraftProposals();
  }

  goBack(): void {
    this.location.back();
  }

  setActiveTab(tab: 'active' | 'history' | 'drafts'): void {
    this.activeTab = tab;
    if (tab === 'history') {
      this.loadProjectHistory();
    }
  }

  loadProjectHistory(): void {
    this.historyError = '';
    if (!this.profile?.id || !this.profile?.role) {
      this.projectHistory = [];
      this.historyError = 'Please log in again to view your project history.';
      return;
    }

    this.isLoadingHistory = true;
    this.http.get<any[]>(`${this.apiUrl}/project-history`, {
      params: {
        userId: this.profile.id,
        role: this.profile.role
      }
    }).subscribe({
      next: (records) => {
        this.isLoadingHistory = false;
        this.projectHistory = records;
      },
      error: (error) => {
        this.isLoadingHistory = false;
        this.projectHistory = [];
        this.historyError = this.getErrorMessage(error, 'Unable to load your project history right now.');
      }
    });
  }

  openCompleteProjectDialog(): void {
    this.showCompleteProjectDialog = true;
    this.completeProjectMessage = '';
  }

  closeCompleteProjectDialog(): void {
    this.showCompleteProjectDialog = false;
    this.completeProjectMessage = '';
  }

  confirmCompleteProject(): void {
    if (!this.selectedProject?.proposalId || !this.profile?.id || !this.profile?.role) {
      this.completeProjectMessage = 'Please log in again before completing the project.';
      return;
    }

    this.isCompletingProject = true;
    this.completeProjectMessage = '';

    this.http.post<{ message: string; completionDate: string; totalPrice: number }>(
      `${this.apiUrl}/myjobs/${this.selectedProject.proposalId}/complete`,
      {
        userId: this.profile.id,
        role: this.profile.role
      }
    ).subscribe({
      next: (response) => {
        const completedProject = this.selectedProject
          ? {
              proposalId: this.selectedProject.proposalId,
              projectId: this.selectedProject.projectId,
              projectTitle: this.selectedProject.title,
              clientId: this.selectedProject.clientId,
              freelancerId: this.selectedProject.freelancerId
            }
          : null;

        this.isCompletingProject = false;
        this.completeProjectMessage = response.message || 'Project completed successfully.';
        this.closeCompleteProjectDialog();
        this.closeProjectDetails();
        this.loadActiveProjects();
        this.setActiveTab('history');
        this.loadProjectHistory();

        if (this.isClient && completedProject?.freelancerId) {
          this.openRatingModal(completedProject);
        }
      },
      error: (error) => {
        this.isCompletingProject = false;
        this.completeProjectMessage = this.getErrorMessage(error, 'Unable to complete the project right now.');
      }
    });
  }

  openSubmission(project?: MyjobActiveProjectCard): void {
    this.submissionProject = project || this.selectedProject;
    this.deliveryError = '';
    this.deliverySuccessMessage = '';
    this.deliveryMessage = this.submissionProject?.deliveryMessage || '';
    this.deliveryFiles = [...(this.submissionProject?.deliveryFiles || [])];
    this.showSubmission = true;
  }

  handleActiveProjectAction(project: MyjobActiveProjectCard): void {
    if (project.actionDisabled) {
      return;
    }

    this.openSubmission(project);
  }

  openProjectDetails(project: MyjobActiveProjectCard): void {
    this.selectedProject = project;
    this.selectedProjectError = '';
    this.statusUpdateMessage = '';
    this.selectedProjectDescription = project.pitch || '';
    this.selectedProjectCategory = '';
    this.selectedProjectType = '';
    this.selectedProjectBriefFileName = '';
    this.selectedProjectBriefFileData = '';

    if (project.projectId) {
      this.loadSelectedProjectDetails(project.projectId);
      this.loadProjectSprints(project);
    }
  }

  payForSprint(sprint: SprintRecord): void {
    if (!this.profile?.id || this.profile.role !== 'client') {
      this.selectedProjectError = 'Only clients can pay for sprint deliveries.';
      return;
    }

    this.selectedProjectError = '';
    this.paymentError = '';
    this.paymentSuccessMessage = '';
    this.paymentSprint = sprint;
    this.showPaymentModal = true;
  }

  closeProjectDetails(): void {
    this.selectedProject = null;
    this.isLoadingSelectedProject = false;
    this.isUpdatingProjectStatus = false;
    this.selectedProjectError = '';
    this.statusUpdateMessage = '';
    this.selectedProjectDescription = '';
    this.selectedProjectCategory = '';
    this.selectedProjectType = '';
    this.selectedProjectBriefFileName = '';
    this.selectedProjectBriefFileData = '';
  }

  closeSubmission(): void {
    this.showSubmission = false;
    this.isReadingDeliveryFiles = false;
    this.isSubmittingDelivery = false;
    this.deliveryError = '';
    this.deliverySuccessMessage = '';
    this.deliveryMessage = '';
    this.deliveryPrice = 0;
    this.deliveryFiles = [];
    this.submissionProject = null;
  }

  closePaymentModal(): void {
    if (this.isProcessingPayment) {
      return;
    }

    this.showPaymentModal = false;
    this.paymentSprint = null;
    this.paymentError = '';
    this.paymentSuccessMessage = '';
  }

  submitPayment(): void {
    if (!this.profile?.id || this.profile.role !== 'client') {
      this.paymentError = 'Only clients can pay for sprint deliveries.';
      return;
    }

    if (!this.paymentSprint) {
      this.paymentError = 'Please select a sprint to pay for.';
      return;
    }

    const normalizedCardNumber = this.cardNumber.replace(/\s+/g, '');
    if (!normalizedCardNumber || !this.expiryDate.trim() || !this.cvv.trim()) {
      this.paymentError = 'Card number, expiry date, and CVV are required.';
      return;
    }

    this.isProcessingPayment = true;
    this.paymentError = '';
    this.paymentSuccessMessage = '';
    this.selectedProjectError = '';

    const sprint = this.paymentSprint;

    this.http.post<{ message: string; paymentStatus: string; workflowStatus: string; totalPaidAmount: number; remainingBudgetAmount: number }>(
      `${this.apiUrl}/sprints/${sprint.sprintId}/pay`,
      {
        userId: this.profile.id,
        role: this.profile.role,
        amount: sprint.price,
        cardNumber: normalizedCardNumber,
        expiryDate: this.expiryDate.trim(),
        cvv: this.cvv.trim()
      }
    ).subscribe({
      next: (response) => {
        this.isProcessingPayment = false;
        this.isUpdatingProjectStatus = false;
        this.paymentSuccessMessage = response.message || 'Sprint payment completed successfully.';
        this.statusUpdateMessage = this.paymentSuccessMessage;

        if (this.selectedProject?.sprints) {
          this.selectedProject.sprints = this.selectedProject.sprints.map((item) => (
            item.sprintId === sprint.sprintId ? { ...item, status: 'paid', paidAtLabel: 'Just now', canAccessFiles: true, submittedAt: item.submittedAt || 'now' } : item
          ));
          this.selectedProject.hasUnpaidSubmittedSprints = this.hasUnpaidSubmittedSprints(this.selectedProject.sprints);
        }

        this.loadActiveProjects();
        if (this.selectedProject) {
          this.loadProjectSprints(this.selectedProject);
        }
      },
      error: (error) => {
        this.isProcessingPayment = false;
        this.isUpdatingProjectStatus = false;
        this.paymentError = this.getErrorMessage(error, 'Unable to process sprint payment right now.');
      }
    });
  }

  openRatingModal(project: ReviewProjectContext): void {
    this.reviewProject = project;
    this.reviewProfessionalism = 5;
    this.reviewQualityOfCode = 5;
    this.reviewError = '';
    this.reviewSuccessMessage = '';
    this.isSubmittingReview = false;
    this.showRatingModal = true;
  }

  closeRatingModal(): void {
    if (this.isSubmittingReview) {
      return;
    }

    this.showRatingModal = false;
    this.reviewProject = null;
    this.reviewError = '';
    this.reviewSuccessMessage = '';
  }

  getReviewStars(_rating: number): number[] {
    return [1, 2, 3, 4, 5];
  }

  setReviewProfessionalism(rating: number): void {
    this.reviewProfessionalism = rating;
    this.reviewError = '';
    this.reviewSuccessMessage = '';
  }

  setReviewQualityOfCode(rating: number): void {
    this.reviewQualityOfCode = rating;
    this.reviewError = '';
    this.reviewSuccessMessage = '';
  }

  submitFreelancerReview(): void {
    if (!this.profile?.id || this.profile.role !== 'client') {
      this.reviewError = 'Only clients can submit freelancer reviews.';
      return;
    }

    if (!this.reviewProject?.freelancerId || (!this.reviewProject.proposalId && !this.reviewProject.projectId)) {
      this.reviewError = 'Missing project details for this review.';
      return;
    }

    this.isSubmittingReview = true;
    this.reviewError = '';
    this.reviewSuccessMessage = '';

    this.http.post<{ message: string }>(`${this.apiUrl}/rate`, {
      userId: this.profile.id,
      role: this.profile.role,
      proposalId: this.reviewProject.proposalId || '',
      projectId: this.reviewProject.projectId || '',
      projectTitle: this.reviewProject.projectTitle || '',
      clientId: this.reviewProject.clientId || this.profile.id,
      freelancerId: this.reviewProject.freelancerId,
      professionalismRating: this.reviewProfessionalism,
      qualityOfCodeRating: this.reviewQualityOfCode
    }).subscribe({
      next: (response) => {
        this.isSubmittingReview = false;
        this.reviewSuccessMessage = response.message || 'Freelancer review saved successfully.';
      },
      error: (error) => {
        this.isSubmittingReview = false;
        this.reviewError = this.getErrorMessage(error, 'Unable to save your review right now.');
      }
    });
  }

  onDeliveryFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files || []);

    if (!selectedFiles.length) {
      return;
    }

    this.deliveryError = '';
    this.deliverySuccessMessage = '';

    const existingBytes = this.deliveryFiles.reduce((total, file) => total + this.estimateDataUrlSize(file.fileData), 0);
    const selectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
    if (existingBytes + selectedBytes > this.maxDeliveryBytes) {
      this.deliveryError = 'Delivery files are too large. Keep the combined upload under 8MB.';
      input.value = '';
      return;
    }

    this.isReadingDeliveryFiles = true;

    Promise.all(selectedFiles.map((file) => this.readDeliveryFile(file)))
      .then((files) => {
        this.deliveryFiles = [...this.deliveryFiles, ...files];
        this.isReadingDeliveryFiles = false;
        input.value = '';
      })
      .catch(() => {
        this.isReadingDeliveryFiles = false;
        this.deliveryError = 'Unable to read one or more delivery files. Please try again.';
        input.value = '';
      });
  }

  removeDeliveryFile(index: number): void {
    this.deliveryFiles = this.deliveryFiles.filter((_, currentIndex) => currentIndex !== index);
  }

  submitDeliveryAssets(): void {
    if (!this.submissionProject?.proposalId || !this.profile?.id || this.profile.role !== 'freelancer') {
      this.deliveryError = 'Please log in as a freelancer before delivering assets.';
      return;
    }

    if (this.isReadingDeliveryFiles) {
      this.deliveryError = 'Please wait for the selected files to finish loading.';
      return;
    }

    if (!this.deliveryFiles.length) {
      this.deliveryError = 'Please attach at least one file before submitting your delivery.';
      return;
    }

    const proposalId = this.submissionProject.proposalId;
    this.isSubmittingDelivery = true;
    this.deliveryError = '';
    this.deliverySuccessMessage = '';

    this.http.post<DeliveryAssetsResponse>(`${this.apiUrl}/myjobs/${proposalId}/deliver-assets`, {
      userId: this.profile.id,
      role: this.profile.role,
      deliveryMessage: this.deliveryMessage.trim(),
      deliveryFiles: this.deliveryFiles,
      requestedAmount: this.deliveryPrice,
      paymentType: this.deliveryPrice > 0 ? 'paid' : 'unpaid'
    }).subscribe({
      next: (response) => {
        const workflowStatus = this.normalizeWorkflowStatus(response.workflowStatus);
        const updatedFiles = Array.isArray(response.deliveryFiles) ? response.deliveryFiles : this.deliveryFiles;
        const updatedMessage = response.deliveryMessage ?? this.deliveryMessage.trim();
        const submittedLabel = response.deliverySubmittedAtLabel || 'Just now';

        this.isSubmittingDelivery = false;
        this.deliverySuccessMessage = response.message || 'Assets delivered successfully.';
        this.statusUpdateMessage = this.deliverySuccessMessage;
        this.applyDeliveryUpdate(proposalId, workflowStatus, updatedFiles, updatedMessage, submittedLabel);
        this.closeSubmission();
        this.loadActiveProjects();
        if (this.submissionProject) {
          this.loadProjectSprints(this.submissionProject);
        }
      },
      error: (error) => {
        this.isSubmittingDelivery = false;
        this.deliveryError = this.getErrorMessage(error, 'Unable to deliver assets right now.');
      }
    });
  }

  acceptProposal(proposalId: string): void {
    this.updateProposalStatus(proposalId, 'accept');
  }

  refuseProposal(proposalId: string): void {
    this.updateProposalStatus(proposalId, 'refuse');
  }

  openProposalAttachment(proposal: SendProposalRecord): void {
    if (!proposal.attachmentFileData) {
      this.attachmentError = 'This attachment is not available for preview.';
      return;
    }

    this.attachmentError = '';
    this.openFilePreview(proposal.attachmentFileName || 'Proposal attachment', proposal.attachmentFileData);
  }

  openSelectedProjectBrief(): void {
    const fileName = this.selectedProjectBriefFileName || this.selectedProject?.attachmentFileName || '';
    const fileData = this.selectedProjectBriefFileData || this.selectedProject?.attachmentFileData || '';

    if (!fileData) {
      this.selectedProjectError = 'This task does not have a brief file available for preview yet.';
      return;
    }

    this.selectedProjectError = '';
    this.openFilePreview(fileName || 'Project brief', fileData);
  }

  closePreview(): void {
    this.showFilePreview = false;
    this.safePreviewUrl = null;
    this.previewTitle = '';
    this.previewFileData = null;
  }

  openDeliveryFile(file: MyjobDeliveryFile): void {
    if (this.canPreviewFile(file.fileData)) {
      this.openFilePreview(file.fileName, file.fileData);
      return;
    }

    this.downloadDataFile(file.fileName, file.fileData);
  }

  downloadDeliveryFile(file: MyjobDeliveryFile): void {
    this.downloadDataFile(file.fileName, file.fileData);
  }

  canPreviewFile(fileData: string): boolean {
    return fileData.startsWith('data:application/pdf') || fileData.startsWith('data:image/');
  }

  updateSelectedProjectWorkflowStatus(nextStatus: MyjobWorkflowStatus): void {
    if (!this.selectedProject?.proposalId || !this.profile?.id || !this.profile?.role) {
      this.selectedProjectError = 'Please log in again before updating task status.';
      return;
    }

    if (this.selectedProject.workflowStatus === nextStatus) {
      return;
    }

    const proposalId = this.selectedProject.proposalId;
    const previousStatus = this.selectedProject.workflowStatus;
    this.isUpdatingProjectStatus = true;
    this.selectedProjectError = '';
    this.statusUpdateMessage = '';
    this.applyWorkflowStatus(proposalId, nextStatus);

    this.http.patch<{ message: string; workflowStatus: string }>(
      `${this.apiUrl}/myjobs/${proposalId}/workflow-status`,
      {
        userId: this.profile.id,
        role: this.profile.role,
        workflowStatus: nextStatus
      }
    ).subscribe({
      next: (response) => {
        this.isUpdatingProjectStatus = false;
        this.statusUpdateMessage = response.message || 'Task status updated successfully.';
      },
      error: (error) => {
        this.isUpdatingProjectStatus = false;
        this.applyWorkflowStatus(proposalId, previousStatus);
        this.selectedProjectError = error?.error?.errors
          ? Object.values(error.error.errors).join(' ')
          : 'Unable to update this task status right now.';
      }
    });
  }

  formatBudget(value?: number): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 'Budget not specified';
    }

    return `$${value.toLocaleString()}`;
  }

  formatTaskReference(value?: string): string {
    if (!value) {
      return '#FW-0000';
    }

    return `#FW-${value.slice(-4).toUpperCase()}`;
  }

  get isClient(): boolean {
    return this.profile?.role === 'client';
  }

  get isFreelancer(): boolean {
    return this.profile?.role === 'freelancer';
  }

  get selectedProjectMeta(): WorkflowMeta | null {
    return this.selectedProject ? this.getWorkflowMeta(this.selectedProject.workflowStatus) : null;
  }

  get selectedProjectPrimaryAction(): { label: string; icon: string; disabled: boolean; nextStatus?: MyjobWorkflowStatus } {
    const meta = this.selectedProjectMeta;
    if (!meta) {
      return { label: 'Update Status', icon: 'sync', disabled: true };
    }

    return {
      label: meta.actionLabel,
      icon: meta.actionIcon,
      disabled: !meta.nextStatus || this.isUpdatingProjectStatus,
      nextStatus: meta.nextStatus
    };
  }

  get selectedProjectMilestones(): TaskMilestone[] {
    const status = this.selectedProject?.workflowStatus || 'in-progress';

    if (status === 'completed') {
      return [
        { title: 'Kickoff & alignment', state: 'done' },
        { title: 'Production work', state: 'done' },
        { title: 'Client review', state: 'done' },
        { title: 'Final delivery', state: 'done' },
      ];
    }

    if (status === 'in-review') {
      return [
        { title: 'Kickoff & alignment', state: 'done' },
        { title: 'Production work', state: 'done' },
        { title: 'Client review', state: 'current' },
        { title: 'Final delivery', state: 'pending' },
      ];
    }

    return [
      { title: 'Kickoff & alignment', state: 'done' },
      { title: 'Production work', state: 'current' },
      { title: 'Client review', state: 'pending' },
      { title: 'Final delivery', state: 'pending' },
    ];
  }

  get selectedProjectCounterpartyLabel(): string {
    return this.isFreelancer ? 'Client' : 'Freelancer';
  }

  get selectedProjectCounterpartyName(): string {
    if (!this.selectedProject) {
      return 'Unknown';
    }

    return this.isFreelancer
      ? (this.selectedProject.clientName || 'Unknown client')
      : (this.selectedProject.freelancerName || 'Unknown freelancer');
  }

  get selectedProjectDeadlineLabel(): string {
    const deadlineDays = this.selectedProject?.projectDeadlineDays;
    if (typeof deadlineDays !== 'number' || Number.isNaN(deadlineDays)) {
      return 'Not set';
    }

    return `${deadlineDays} days`;
  }

  get selectedProjectSummary(): string {
    return this.selectedProjectDescription || this.selectedProject?.pitch || 'No project notes available yet.';
  }

  private loadActiveProjects(): void {
    this.activeProjectsError = '';

    if (!this.profile?.id || !this.profile?.role) {
      this.activeProjects = [];
      this.activeProjectsError = 'Please log in again to view your active tasks.';
      return;
    }

    this.isLoadingActiveProjects = true;
    this.http.get<ActiveMyjobRecord[]>(`${this.apiUrl}/myjobs/active`, {
      params: {
        userId: this.profile.id,
        role: this.profile.role
      }
    }).subscribe({
      next: (records) => {
        this.isLoadingActiveProjects = false;
        this.activeProjects = records.map((record) => this.buildActiveProjectCard(record));
        this.refreshOpenProjectState();
      },
      error: (error) => {
        this.isLoadingActiveProjects = false;
        this.activeProjects = [];
        this.activeProjectsError = this.getErrorMessage(error, 'Unable to load your active tasks right now.');
      }
    });
  }

  private loadDraftProposals(): void {
    this.draftsError = '';
    this.attachmentError = '';

    if (!this.profile?.id || !this.profile?.role) {
      this.draftProposals = [];
      this.draftsError = 'Please log in again to view your proposal drafts.';
      return;
    }

    this.isLoadingDrafts = true;
    this.http.get<SendProposalRecord[]>(`${this.apiUrl}/send-proposals`, {
      params: {
        userId: this.profile.id,
        role: this.profile.role
      }
    }).subscribe({
      next: (proposals) => {
        this.isLoadingDrafts = false;
        this.draftProposals = proposals;
      },
      error: (error) => {
        this.isLoadingDrafts = false;
        this.draftProposals = [];
        this.draftsError = this.getErrorMessage(error, 'Unable to load your proposal drafts right now.');
      }
    });
  }

  private loadSelectedProjectDetails(projectId: string): void {
    this.isLoadingSelectedProject = true;
    this.selectedProjectError = '';

    this.http.get<ProjectDetailsResponse>(`${this.apiUrl}/projects/${projectId}`).subscribe({
      next: (project) => {
        this.isLoadingSelectedProject = false;
        this.selectedProjectDescription = project.description || this.selectedProjectDescription;
        this.selectedProjectCategory = project.category || '';
        this.selectedProjectType = this.formatProjectType(project.projectType);
        this.selectedProjectBriefFileName = project.briefFileName || '';
        this.selectedProjectBriefFileData = project.briefFileData || '';
      },
      error: (error) => {
        this.isLoadingSelectedProject = false;
        this.selectedProjectError = this.getErrorMessage(error, 'Unable to load this project brief right now.');
      }
    });
  }

  private loadProjectSprints(project: MyjobActiveProjectCard): void {
    if (!this.profile?.id || !this.profile?.role || !project.projectId) {
      return;
    }

    this.http.get<any[]>(`${this.apiUrl}/sprints`, {
      params: {
        projectId: project.projectId,
        clientId: project.clientId || '',
        freelancerId: project.freelancerId || '',
        userId: this.profile.id,
        role: this.profile.role
      }
    }).subscribe({
      next: (sprints) => {
        const normalizedSprints = Array.isArray(sprints)
          ? sprints.map((item) => this.normalizeSprintRecord(item))
          : [];

        const selectedProject = this.selectedProject;
        if (selectedProject && selectedProject.proposalId === project.proposalId) {
          selectedProject.sprints = normalizedSprints;
          selectedProject.hasUnpaidSubmittedSprints = this.hasUnpaidSubmittedSprints(normalizedSprints);
        }

        this.activeProjects = this.activeProjects.map((activeProject) =>
          activeProject.proposalId === project.proposalId
            ? { ...activeProject, sprints: normalizedSprints, hasUnpaidSubmittedSprints: this.hasUnpaidSubmittedSprints(normalizedSprints) }
            : activeProject
        );
      },
      error: () => {
        // ignore sprint loading failures for now; existing active project state remains usable
      }
    });
  }

  private normalizeSprintRecord(record: any): SprintRecord {
    return {
      sprintId: record.id,
      sprintNumber: record.sprintNumber || 0,
      title: record.title || `Sprint ${record.sprintNumber || 0}`,
      description: record.description || '',
      status: record.status === 'paid' ? 'paid' : 'unpaid',
      price: record.price || 0,
      deliveryMessage: record.deliveryMessage || '',
      deliveryFiles: Array.isArray(record.deliveryFiles) ? record.deliveryFiles : [],
      submittedAtLabel: record.deliveredAtLabel || record.submittedAtLabel || '',
      paidAtLabel: record.paidAtLabel || '',
      submittedAt: record.deliveredAtLabel || record.submittedAtLabel || undefined,
      canAccessFiles: !!record.canAccessFiles,
    };
  }

  private updateProposalStatus(proposalId: string, action: 'accept' | 'refuse'): void {
    if (!this.profile?.id || this.profile.role !== 'client') {
      this.draftsError = 'Only clients can manage proposal requests.';
      return;
    }

    this.processingProposalId = proposalId;
    this.actionMessage = '';
    this.draftsError = '';

    this.http.patch<{ message: string }>(`${this.apiUrl}/send-proposals/${proposalId}`, {
      action,
      userId: this.profile.id,
      role: this.profile.role
    }).subscribe({
      next: (response) => {
        this.processingProposalId = '';
        this.actionMessage = response.message || 'Proposal updated successfully.';
        this.loadActiveProjects();
        this.loadDraftProposals();
      },
      error: (error) => {
        this.processingProposalId = '';
        this.draftsError = this.getErrorMessage(error, 'Unable to update this proposal right now.');
      }
    });
  }

  private buildActiveProjectCard(record: ActiveMyjobRecord): MyjobActiveProjectCard {
    const workflowStatus = this.normalizeWorkflowStatus(record.workflowStatus);

    return this.decorateProjectCard({
      id: record.id,
      proposalId: record.proposalId,
      projectId: record.projectId,
      clientId: record.clientId,
      freelancerId: record.freelancerId,
      title: record.projectTitle,
      orderId: record.projectId || record.proposalId,
      timeLabel: record.acceptedAtLabel,
      status: '',
      statusClass: '',
      workflowStatus,
      clientName: this.isFreelancer ? (record.client?.name || 'Unknown client') : undefined,
      freelancerName: this.isClient ? (record.freelancer?.name || 'Unknown freelancer') : undefined,
      helperText: record.duration ? `Duration: ${record.duration}` : 'Accepted project',
      projectBudget: record.projectBudget,
      projectDeadlineDays: record.projectDeadlineDays,
      pitch: record.pitch,
      duration: record.duration,
      attachmentFileName: record.attachmentFileName,
      attachmentFileData: record.attachmentFileData,
      deliveryMessage: record.deliveryMessage,
      deliveryFiles: Array.isArray(record.deliveryFiles) ? record.deliveryFiles : [],
      deliverySubmittedAtLabel: record.deliverySubmittedAtLabel,
      sprints: record.sprints,
      totalPaidAmount: record.totalPaidAmount,
      remainingBudgetAmount: record.remainingBudgetAmount,
      hasUnreadUpdate: record.hasUnreadUpdate,
      hasUnpaidSubmittedSprints: (record.sprints || []).some(s => s.status === 'unpaid' && s.submittedAt),
      actionLabel: this.isFreelancer ? 'Submit Work' : undefined,
      actionIcon: this.isFreelancer ? 'arrow_forward' : undefined,
      actionDisabled: this.isClient
    }, workflowStatus);
  }

  private decorateProjectCard(
    project: MyjobActiveProjectCard,
    workflowStatus: MyjobWorkflowStatus
  ): MyjobActiveProjectCard {
    const meta = this.getWorkflowMeta(workflowStatus);

    return {
      ...project,
      workflowStatus,
      status: meta.label,
      statusClass: meta.cardBadgeClass,
      progressPercent: meta.progressPercent,
      progressBarClass: meta.progressBarClass,
    };
  }

  private applyWorkflowStatus(proposalId: string, workflowStatus: MyjobWorkflowStatus): void {
    this.activeProjects = this.activeProjects.map((project) => (
      project.proposalId === proposalId
        ? this.decorateProjectCard(project, workflowStatus)
        : project
    ));

    const updatedProject = this.activeProjects.find((project) => project.proposalId === proposalId) || null;
    if (updatedProject && this.selectedProject?.proposalId === proposalId) {
      this.selectedProject = updatedProject;
    }

    if (updatedProject && this.submissionProject?.proposalId === proposalId) {
      this.submissionProject = updatedProject;
    }
  }

  private applyDeliveryUpdate(
    proposalId: string,
    workflowStatus: MyjobWorkflowStatus,
    deliveryFiles: MyjobDeliveryFile[],
    deliveryMessage: string,
    deliverySubmittedAtLabel: string
  ): void {
    this.activeProjects = this.activeProjects.map((project) => {
      if (project.proposalId !== proposalId) {
        return project;
      }

      return this.decorateProjectCard({
        ...project,
        deliveryFiles,
        deliveryMessage,
        deliverySubmittedAtLabel
      }, workflowStatus);
    });

    const updatedProject = this.activeProjects.find((project) => project.proposalId === proposalId) || null;
    if (updatedProject && this.selectedProject?.proposalId === proposalId) {
      this.selectedProject = updatedProject;
    }

    if (updatedProject && this.submissionProject?.proposalId === proposalId) {
      this.submissionProject = updatedProject;
    }
  }

  private refreshOpenProjectState(): void {
    if (this.selectedProject?.proposalId) {
      const updatedSelectedProject = this.activeProjects.find((project) => project.proposalId === this.selectedProject?.proposalId);
      if (updatedSelectedProject) {
        this.selectedProject = updatedSelectedProject;
      }
    }

    if (this.submissionProject?.proposalId) {
      const updatedSubmissionProject = this.activeProjects.find((project) => project.proposalId === this.submissionProject?.proposalId);
      if (updatedSubmissionProject) {
        this.submissionProject = updatedSubmissionProject;
      }
    }
  }

  private getWorkflowMeta(status: MyjobWorkflowStatus): WorkflowMeta {
    if (status === 'completed') {
      return {
        label: 'Completed',
        description: 'All deliverables have been finalized and approved.',
        cardBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        progressPercent: 100,
        progressBarClass: 'bg-emerald-500',
        detailBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
        actionLabel: 'Project Completed',
        actionIcon: 'task_alt'
      };
    }

    if (status === 'in-review') {
      return {
        label: 'In Review',
        description: 'The work is ready for review before final sign-off.',
        cardBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        progressPercent: 84,
        progressBarClass: 'bg-amber-500',
        detailBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
        actionLabel: 'Mark as Completed',
        actionIcon: 'check_circle',
        nextStatus: 'completed'
      };
    }

    return {
      label: 'In Progress',
      description: 'This task is currently being worked on.',
      cardBadgeClass: 'bg-secondary/10 text-secondary border-secondary/20',
      progressPercent: 56,
      progressBarClass: 'bg-secondary',
      detailBadgeClass: 'bg-secondary/10 text-secondary border-secondary/20',
      dotClass: 'bg-secondary',
      actionLabel: 'Move to Review',
      actionIcon: 'published_with_changes',
      nextStatus: 'in-review'
    };
  }

  private normalizeWorkflowStatus(value?: string): MyjobWorkflowStatus {
    if (value === 'completed') {
      return 'completed';
    }

    if (value === 'in-review' || value === 'review') {
      return 'in-review';
    }

    return 'in-progress';
  }

  private hasUnpaidSubmittedSprints(sprints?: SprintRecord[]): boolean {
    if (!sprints || !Array.isArray(sprints)) {
      return false;
    }

    return sprints.some(sprint => sprint.status === 'unpaid' && sprint.submittedAt);
  }

  private formatProjectType(value?: string): string {
    if (!value) {
      return 'Project';
    }

    if (value === 'fixed-price') {
      return 'Fixed Price';
    }

    if (value === 'hourly') {
      return 'Hourly';
    }

    return 'Project';
  }

  private openFilePreview(fileName: string, fileData: string): void {
    this.previewTitle = fileName;
    this.previewFileData = fileData;
    this.isPreviewPdf = fileData.startsWith('data:application/pdf');
    this.isPreviewImage = fileData.startsWith('data:image/');
    this.safePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileData);
    this.showFilePreview = true;
  }

  downloadPreviewFile(): void {
    if (!this.previewFileData || !this.previewTitle) {
      return;
    }

    this.downloadDataFile(this.previewTitle, this.previewFileData);
  }

  private downloadDataFile(fileName: string, fileData: string): void {
    const anchor = document.createElement('a');
    anchor.href = fileData;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private readDeliveryFile(file: File): Promise<MyjobDeliveryFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Unable to read file'));
          return;
        }

        resolve({
          fileName: file.name,
          fileData: reader.result,
          mimeType: file.type || ''
        });
      };
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });
  }

  private estimateDataUrlSize(value: string): number {
    const normalized = value.includes(',') ? value.split(',', 2)[1] : value;
    const padding = (normalized.match(/=/g) || []).length;
    return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
  }

  private getErrorMessage(error: any, fallback: string): string {
    return error?.error?.errors
      ? Object.values(error.error.errors).join(' ')
      : fallback;
  }

  private getStoredProfile(): StoredProfile | null {
    const rawProfile = localStorage.getItem('fw_profile');
    if (!rawProfile) {
      return null;
    }

    try {
      return JSON.parse(rawProfile) as StoredProfile;
    } catch {
      return null;
    }
  }
}
