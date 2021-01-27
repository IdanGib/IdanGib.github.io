import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TakePhotoComponent } from './take-photo/take-photo.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';



@NgModule({
  declarations: [TakePhotoComponent],
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule
  ],
  exports: [
    TakePhotoComponent
  ]
})
export class CameraModule { }
