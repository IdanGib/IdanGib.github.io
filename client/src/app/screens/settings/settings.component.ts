import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppService } from 'src/app/app.service';
import { DialogData, EditDialogComponent } from 'src/app/edit-dialog/edit-dialog.component';
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
    /*this.openDialog({ 
      title: field, 
      content: {[field]: this.app.state[field]} 
    });*/
    this.router.navigateByUrl(`settings/${field}`);
  }

  openDialog(data: DialogData): void {
    const dialogRef = this.dialog.open(EditDialogComponent, {
      width: '90%',
      data
    });

    const s = dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
      this.app.saveState();
      s?.unsubscribe();
    });
  }
}
