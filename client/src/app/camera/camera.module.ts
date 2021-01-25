import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TakePhotoComponent } from './take-photo/take-photo.component';
import { MatButtonModule } from '@angular/material/button';



@NgModule({
  declarations: [TakePhotoComponent],
  imports: [
    CommonModule,
    MatButtonModule
  ],
  exports: [
    TakePhotoComponent
  ]
})
export class CameraModule { }
