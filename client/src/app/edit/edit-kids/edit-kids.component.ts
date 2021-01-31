import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AppService } from 'src/app/app.service';
import { IKid } from 'src/app/logic/interfaces';
import { ImageDialogComponent } from 'src/app/dialogs/image-dialog/dialog.component';
import { Kid } from 'src/app/logic/models/kid';
@Component({
  selector: 'app-edit-kids',
  templateUrl: './edit-kids.component.html',
  styleUrls: ['./edit-kids.component.scss']
})
export class EditKidsComponent implements OnInit {
  @Input() data: IKid[];
  newKid: IKid;
  constructor(private app: AppService, private imageDialog: MatDialog) { 
    this.reset();
  }

  add(newKid: IKid) {
    this.app.updateKids(newKid);
    this.reset();
  }
  editImage(newKid: IKid) {
    const dialogRef = this.imageDialog.open(ImageDialogComponent, {
      width: '90%',
      data:{
        image: (img: string) => {
            newKid.image = img;
            dialogRef.close();
        }
      }
    });
  }
  ngOnInit(): void {
    this.data = this.data || this.app.state.kids;
    this.reset();
  }

  get invalidName(): boolean {
    const name = this.newKid.name;
    return (!name) || this.data.some(d => d.name === name);
  }

  reset( ){
    this.newKid = new Kid('', '', 0);
  }

  delete(kid: IKid) {
    this.app.removeKids(kid);
  }

}
