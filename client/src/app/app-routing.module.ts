import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TakePhotoComponent } from './camera/take-photo/take-photo.component';
import { EditGiftsComponent } from './edit/edit-gifts/edit-gifts.component';
import { EditKidsComponent } from './edit/edit-kids/edit-kids.component';
import { EditProfileComponent } from './edit/edit-profile/edit-profile.component';
import { IndexComponent } from './image-to-text/index/index.component';
import { KidComponent } from './screens/kid/kid.component';
import { SettingsComponent } from './screens/settings/settings.component';
import { StoreComponent } from './screens/store/store.component';
import { SummaryComponent } from './screens/summary/summary.component';

const routes: Routes = [
  { path: '', component: SummaryComponent },
  { path: 'store', component: StoreComponent },
  { path: 'camera', component: TakePhotoComponent },
  { path: 'settings/kids', component: EditKidsComponent },
  { path: 'settings/gifts', component: EditGiftsComponent },
  { path: 'settings/profile', component: EditProfileComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'kid/:id', component: KidComponent },
  { path: 'itt', component: IndexComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
