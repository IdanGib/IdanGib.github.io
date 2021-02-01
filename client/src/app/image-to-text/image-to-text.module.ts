import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index/index.component';
import { CameraModule } from '../camera/camera.module';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import {MatSelectModule} from '@angular/material/select';

@NgModule({
  declarations: [IndexComponent],
  imports: [
    CommonModule,
    CameraModule,
    FormsModule,
    MatButtonModule,
    MatSelectModule
  ],
  exports: [
    IndexComponent
  ]
})
export class ImageToTextModule { }
