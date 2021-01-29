import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';
enum SettingsFileds {
  kids ='kids',
  gifts = 'gifts',
  profile = 'profile'
}
@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  title = 'Settings';
  settingsFileds = SettingsFileds;
  now = new Date();
  constructor(public app: AppService, public dialog: MatDialog, private router: Router) { }

  ngOnInit(): void {
  }

  edit(field: SettingsFileds) {
    this.router.navigateByUrl(`settings/${field}`);
  }


}
