import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Conversation {
  id?: string;
  name: string;
  time: string;
  preview: string;
  isOnline?: boolean;
  isUnread?: boolean;
}

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class MessageComponent implements OnInit {
  searchTerm = '';
  conversations: Conversation[] = [];

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadConversations();
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
    this.http.get<Conversation[]>(`${environment.apiUrl}/conversations`).subscribe({
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
