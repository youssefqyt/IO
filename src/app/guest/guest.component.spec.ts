import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { provideRouter } from '@angular/router';

import { GuestComponent } from './guest.component';

describe('GuestComponent', () => {
  let component: GuestComponent;
  let fixture: ComponentFixture<GuestComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), GuestComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(GuestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
