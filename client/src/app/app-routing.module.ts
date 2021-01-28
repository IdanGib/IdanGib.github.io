import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EditGiftsComponent } from './edit-dialog/edit-gifts/edit-gifts.component';
import { EditKidsComponent } from './edit-dialog/edit-kids/edit-kids.component';
import { EditProfileComponent } from './edit-dialog/edit-profile/edit-profile.component';
import { KidComponent } from './screens/kid/kid.component';
import { SettingsComponent } from './screens/settings/settings.component';
import { StoreComponent } from './screens/store/store.component';
import { SummaryComponent } from './screens/summary/summary.component';

const routes: Routes = [
  { path: '', component: SummaryComponent },
  { path: 'store', component: StoreComponent },
  { path: 'settings/kids', component: EditKidsComponent },
  { path: 'settings/gifts', component: EditGiftsComponent },
  { path: 'settings/profile', component: EditProfileComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'kid/:id', component: KidComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
