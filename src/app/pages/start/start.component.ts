import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class StartComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
