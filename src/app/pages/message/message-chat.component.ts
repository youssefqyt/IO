import { Component, OnDestroy, OnInit } from '@angular/core';
import { Location, CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { environment } from '../../../environments/environment';

interface ChatMessage {
  id?: string;
  conversationId: string;
  projectId?: string;
  senderId: string;
  receiverId: string;
  senderRole: 'client' | 'freelancer';
  message: string;
  createdAt: string;
  time: string;
}

interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: 'freelancer' | 'client';
}

@Component({
  selector: 'app-message-chat',
  templateUrl: './message-chat.component.html',
  styleUrls: ['./message-chat.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class MessageChatComponent implements OnInit, OnDestroy {
  messages: ChatMessage[] = [];
  messageText = '';
  conversationId = '';
  projectId = '';
  otherUserId = '';
  otherUserName = '';
  profile: Profile | null = null;
  isSending = false;
  private pollingTimer?: number;

  constructor(
    private readonly location: Location,
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    this.profile = this.getProfile();
    this.route.queryParamMap.subscribe((params) => {
      this.conversationId = params.get('conversationId') || '';
      this.projectId = params.get('projectId') || '';
      this.otherUserId = params.get('otherUserId') || '';
      this.otherUserName = params.get('otherUserName') || '';
      this.loadMessages();

      this.startPolling();
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    this.stopPolling(); // Clear any existing timer
    this.pollingTimer = window.setInterval(() => {
      // Only poll if document is visible (user hasn't switched tabs)
      if (!document.hidden) {
        this.loadMessages();
      }
    }, 10000); // Poll every 10 seconds instead of 5
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private getProfile(): Profile | null {
    const raw = localStorage.getItem('fw_profile');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Profile;
    } catch {
      return null;
    }
  }

  private buildConversationId(): string {
    if (this.conversationId) {
      return this.conversationId;
    }
    if (!this.projectId || !this.profile || !this.otherUserId) {
      return '';
    }
    // Ensure consistent ordering: projectId|smaller_id|larger_id
    const ids = [this.profile.id, this.otherUserId].sort();
    return `${this.projectId}|${ids[0]}|${ids[1]}`;
  }

  private loadMessages(): void {
    if (!this.profile?.id || !this.profile?.role || !this.otherUserId) {
      this.messages = [];
      return;
    }

    const conversationId = this.buildConversationId();
    if (!conversationId) {
      this.messages = [];
      return;
    }

    const params = new URLSearchParams();
    params.set('userId', this.profile.id);
    params.set('role', this.profile.role);
    params.set('conversationId', conversationId);
    params.set('projectId', this.projectId);

    this.http
      .get<ChatMessage[]>(`${environment.apiUrl}/messages?${params.toString()}`)
      .subscribe({
        next: (messages) => {
          this.messages = Array.isArray(messages) ? messages : [];
          // Mark messages as read after loading
          this.markMessagesAsRead();
        },
        error: (error) => {
          console.error('Failed to load chat messages', error);
          this.messages = [];
        }
      });
  }

  private markMessagesAsRead(): void {
    if (!this.profile?.id) {
      return;
    }

    const conversationId = this.buildConversationId();
    if (!conversationId) {
      return;
    }

    const params = new URLSearchParams();
    params.set('userId', this.profile.id);
    params.set('conversationId', conversationId);

    this.http
      .post(`${environment.apiUrl}/messages/read?${params.toString()}`, {})
      .subscribe({
        next: () => {
          // Messages marked as read successfully
        },
        error: (error) => {
          console.error('Failed to mark messages as read', error);
        }
      });
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    if (!text || !this.profile?.id || !this.profile?.role || !this.otherUserId) {
      return;
    }

    const conversationId = this.buildConversationId();
    const payload = {
      conversationId,
      projectId: this.projectId,
      clientId: this.profile.role === 'client' ? this.profile.id : this.otherUserId,
      freelancerId: this.profile.role === 'freelancer' ? this.profile.id : this.otherUserId,
      senderId: this.profile.id,
      receiverId: this.otherUserId,
      senderRole: this.profile.role,
      message: text,
    };

    // Optimistically add the message to UI
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      projectId: this.projectId,
      senderId: this.profile.id,
      receiverId: this.otherUserId,
      senderRole: this.profile.role,
      message: text,
      createdAt: new Date().toISOString(),
      time: 'Just now'
    };

    this.messages = [...this.messages, tempMessage];
    const originalMessageText = this.messageText;
    this.messageText = '';
    this.isSending = true;

    this.http.post<ChatMessage>(`${environment.apiUrl}/messages`, payload).subscribe({
      next: (savedMessage) => {
        // Replace temp message with saved message
        this.messages = this.messages.map(msg => 
          msg.id === tempMessage.id ? savedMessage : msg
        );
        this.isSending = false;
      },
      error: (error) => {
        console.error('Failed to send message', error);
        // Remove temp message and restore input
        this.messages = this.messages.filter(msg => msg.id !== tempMessage.id);
        this.messageText = originalMessageText;
        this.isSending = false;
        // TODO: Show error toast to user
      }
    });
  }

  isSentByCurrentUser(message: ChatMessage): boolean {
    return this.profile?.id === message.senderId;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  goBack(): void {
    this.location.back();
  }
}
