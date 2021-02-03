import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AppService } from 'src/app/app.service';
import { ImageDialogComponent } from 'src/app/dialogs/image-dialog/dialog.component';
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

  add(newGift: Partial<IGift>) {
    this.app.updateGifts(newGift);
    this.reset();
  }
  editImage(newGift: Partial<IGift>) {
    const dialogRef = this.imageDialog.open(ImageDialogComponent, {
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
