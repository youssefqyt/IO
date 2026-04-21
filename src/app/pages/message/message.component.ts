import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Conversation {
  id?: string;
  projectId?: string;
  name: string;
  time: string;
  lastMessage: string;
  senderId?: string;
  otherUserId?: string;
  conversationId: string;
  isOnline?: boolean;
  isUnread?: boolean;
}

interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: 'freelancer' | 'client';
}

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class MessageComponent implements OnInit, OnDestroy {
  searchTerm = '';
  conversations: Conversation[] = [];
  private pollingTimer?: number;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.refreshConversations();
    this.startPolling();
  }

  ionViewWillEnter(): void {
    this.refreshConversations();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingTimer = window.setInterval(() => {
      if (!document.hidden) {
        this.loadConversations();
      }
    }, 10000);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private refreshConversations(): void {
    this.loadConversations();
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

  get filteredConversations(): Conversation[] {
    const query = this.searchTerm.trim().toLowerCase();

    if (!query) {
      return this.conversations;
    }

    return this.conversations.filter((conversation) =>
      conversation.name.toLowerCase().includes(query)
    );
  }

  private loadConversations(): void {
    const profile = this.getProfile();
    if (!profile?.id || !profile?.role) {
      console.warn('Unable to load conversations: missing user profile');
      this.conversations = [];
      return;
    }

    this.http
      .get<Conversation[]>(
        `${environment.apiUrl}/conversations?userId=${encodeURIComponent(profile.id)}&role=${encodeURIComponent(profile.role)}`
      )
      .subscribe({
        next: (conversations) => {
          this.conversations = Array.isArray(conversations) ? conversations : [];
        },
        error: (error) => {
          console.error('Failed to load conversations', error);
          this.conversations = [];
        }
      });
  }
}
