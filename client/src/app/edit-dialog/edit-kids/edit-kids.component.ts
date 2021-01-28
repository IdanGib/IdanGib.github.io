import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AppService } from 'src/app/app.service';
import { KidProfile } from 'src/app/logic/interfaces';
import { DialogComponent } from 'src/app/camera/dialog/dialog.component';
@Component({
  selector: 'app-edit-kids',
  templateUrl: './edit-kids.component.html',
  styleUrls: ['./edit-kids.component.scss']
})
export class EditKidsComponent implements OnInit {
  @Input() data: KidProfile[];
  newKid: KidProfile;
  constructor(private app: AppService, private imageDialog: MatDialog) { }

  add(newKid: KidProfile) {
    this.data.push(newKid);
    this.reset();
    this.app.saveState();
  }
  editImage(newKid: KidProfile) {
    const dialogRef = this.imageDialog.open(DialogComponent, {
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
    const display = this.newKid.display;
    return (!display) || this.data.some(d => d.display === display);
  }

  reset( ){
    this.newKid = {
        bag: [],
        display: '',
        stars: 0,
        image: 'https://picsum.photos/200?random=' + Math.floor(Math.random() * 100)
    };
  }

  delete(index: number) {
    this.data.splice(index, 1);
  }

}
