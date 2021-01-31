import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TakePhotoComponent } from './take-photo/take-photo.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BottomSheetDevicesChooser } from './take-photo/take-photo.component';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';


@NgModule({
  declarations: [
    BottomSheetDevicesChooser,
    TakePhotoComponent],
  imports: [
    CommonModule,
    MatIconModule,
    MatBottomSheetModule,
    MatButtonModule
  ],
  exports: [
    TakePhotoComponent
  ]
})
export class CameraModule { }
