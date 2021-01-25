import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TakePhotoComponent } from './camera/take-photo/take-photo.component';
import { KidComponent } from './screens/kid/kid.component';
import { SettingsComponent } from './screens/settings/settings.component';
import { SummaryComponent } from './screens/summary/summary.component';

const routes: Routes = [
  { path: '', component: SummaryComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'kid/:id', component: KidComponent },
  { path: 'camera', component: TakePhotoComponent },
  { path: '**', component: SummaryComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
