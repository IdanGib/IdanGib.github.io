import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TakePhotoComponent } from './take-photo/take-photo.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DialogComponent } from './dialog/dialog.component';
import { BottomSheetDevicesChooser } from './take-photo/take-photo.component';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';


@NgModule({
  declarations: [
    BottomSheetDevicesChooser,
    TakePhotoComponent, DialogComponent],
  imports: [
    CommonModule,
    MatIconModule,
    MatBottomSheetModule,
    MatButtonModule
  ],
  exports: [
    TakePhotoComponent,
    DialogComponent
  ]
})
export class CameraModule { }
