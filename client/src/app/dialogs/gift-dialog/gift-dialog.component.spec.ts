import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GiftDialogComponent } from './gift-dialog.component';

describe('GiftDialogComponent', () => {
  let component: GiftDialogComponent;
  let fixture: ComponentFixture<GiftDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GiftDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GiftDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
