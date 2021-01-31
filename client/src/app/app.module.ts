import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import {MatToolbarModule} from '@angular/material/toolbar';
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonModule} from '@angular/material/button';
import { SettingsComponent } from './screens/settings/settings.component';
import { KidComponent } from './screens/kid/kid.component';
import { SummaryComponent } from './screens/summary/summary.component';
import {AppService } from 'src/app/app.service';
import {MatDialogModule} from '@angular/material/dialog';
import { EditGiftsComponent } from './edit/edit-gifts/edit-gifts.component';
import { EditKidsComponent } from './edit/edit-kids/edit-kids.component';
import { EditProfileComponent } from './edit/edit-profile/edit-profile.component';
import { FormsModule } from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import { CameraModule } from 'src/app/camera/camera.module';
import { StarComponent } from './entities/star/star.component';
import { GiftComponent } from './entities/gift/gift.component';
import { GiftDialog, StoreComponent } from './screens/store/store.component';
import { BagComponent } from './entities/bag/bag.component';
import { MatMenuModule } from '@angular/material/menu';
import { KidDialogComponent } from './dialogs/kid-dialog/kid-dialog.component';
import { GiftDialogComponent } from './dialogs/gift-dialog/gift-dialog.component';
import { MatBadgeModule } from '@angular/material/badge';
import { ImageDialogComponent } from './dialogs/image-dialog/dialog.component';

@NgModule({
  declarations: [
    AppComponent,
    SettingsComponent,
    KidComponent,
    SummaryComponent,
    EditGiftsComponent,
    EditKidsComponent,
    EditProfileComponent,
    StarComponent,
    GiftComponent,
    StoreComponent,
    BagComponent,
    GiftDialog,
    KidDialogComponent,
    GiftDialogComponent,
    ImageDialogComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
    MatListModule,
    CameraModule,
    MatMenuModule,
    MatBadgeModule
  ],
  providers: [AppService],
  bootstrap: [AppComponent]
})
export class AppModule { 
  constructor(private app: AppService) {
    this.app.init();
  }
}
