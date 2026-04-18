import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-message-chat',
  templateUrl: './message-chat.component.html',
  styleUrls: ['./message-chat.component.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class MessageChatComponent {
  constructor(private readonly location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
