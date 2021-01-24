import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGiftsComponent } from './edit-gifts.component';

describe('EditGiftsComponent', () => {
  let component: EditGiftsComponent;
  let fixture: ComponentFixture<EditGiftsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EditGiftsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditGiftsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
