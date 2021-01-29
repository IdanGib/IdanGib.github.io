import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { KidDialogComponent } from './kid-dialog.component';

describe('KidDialogComponent', () => {
  let component: KidDialogComponent;
  let fixture: ComponentFixture<KidDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ KidDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(KidDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
