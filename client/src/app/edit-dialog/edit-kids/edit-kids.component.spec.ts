import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditKidsComponent } from './edit-kids.component';

describe('EditKidsComponent', () => {
  let component: EditKidsComponent;
  let fixture: ComponentFixture<EditKidsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EditKidsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditKidsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
