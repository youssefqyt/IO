import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { AccounteSecuriteComponent } from './accounte-securite.component';

describe('AccounteSecuriteComponent', () => {
  let component: AccounteSecuriteComponent;
  let fixture: ComponentFixture<AccounteSecuriteComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), AccounteSecuriteComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccounteSecuriteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
