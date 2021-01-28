import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TakePhotoComponent } from './take-photo/take-photo.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DialogComponent } from './dialog/dialog.component';



@NgModule({
  declarations: [TakePhotoComponent, DialogComponent],
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule
  ],
  exports: [
    TakePhotoComponent,
    DialogComponent
  ]
})
export class CameraModule { }
