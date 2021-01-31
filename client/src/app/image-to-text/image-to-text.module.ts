import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index/index.component';
import { CameraModule } from '../camera/camera.module';



@NgModule({
  declarations: [IndexComponent],
  imports: [
    CommonModule,
    CameraModule
  ],
  exports: [
    IndexComponent
  ]
})
export class ImageToTextModule { }
