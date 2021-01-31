import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AppService } from 'src/app/app.service';
import { DialogComponent } from 'src/app/camera/dialog/dialog.component';
import { IGift } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-edit-gifts',
  templateUrl: './edit-gifts.component.html',
  styleUrls: ['./edit-gifts.component.scss']
})
export class EditGiftsComponent implements OnInit {
  @Input() data: IGift[];

  ngOnInit(): void {
    this.data = this.data || this.app.state.gifts;
    this.reset();
  }
  newGift: Partial<IGift>;
  constructor(private app: AppService, private imageDialog: MatDialog) { }

  add(newGift: IGift) {
    this.data.push(newGift);
    this.reset();
    this.app.saveState();
  }
  editImage(newGift: IGift) {
    const dialogRef = this.imageDialog.open(DialogComponent, {
      width: '90%',
      data:{
        image: (img: string) => {
            newGift.image = img;
            dialogRef.close();
        }
      }
    });
  }

  get invalidName(): boolean {
    const name = this.newGift.name;
    return (!name) || this.data.some(d => d.name === name);
  }

  reset( ){
    this.newGift = {
        name: '',
        stars: 0,
        image: 'https://picsum.photos/200?random=' + Math.floor(Math.random() * 100)
    };
  }

  delete(index: number) {
    this.data.splice(index, 1);
  }

}
