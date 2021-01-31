import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AppService } from 'src/app/app.service';
import { GiftComponent } from 'src/app/entities/gift/gift.component';
import { IGift, IKid } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-gift-dialog',
  template: `
    <h1>{{ data.title }}</h1>
    <div>
      <mat-action-list>
        <button *ngFor="let kid of data.kids" 
          (click)="data.buy(kid)"
          mat-list-item> 
          {{ kid.name }}
          <mat-icon [style.color]="'gold'">star</mat-icon>
          {{ kid.stars }}
        </button>
      </mat-action-list>
    </div>
    <div mat-dialog-actions>
  <button mat-button mat-dialog-close>Close</button>
</div>
`
}) export class GiftDialog {
  kids: IKid[];
  constructor(@Inject(MAT_DIALOG_DATA) public data: { 
    kids: IKid[],
    title: string
    buy: (kid: IKid) => void
  }) {}
}
@Component({
  selector: 'app-store',
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit {
  gifts: IGift[];
  title: string;
  constructor(private app: AppService, 
    private dialog: MatDialog) { 
    this.title = `Welcome !`;
  }

  ngOnInit(): void {
    this.gifts = this.app.state.gifts;
  }
  info(gift: IGift) {
    this.dialog.open(GiftComponent, {
      width: '90%', 
       data: { gift } })
  }
  buy(gift: IGift) {
    const canBuy =  this.app.state.kids.filter(k => k.stars >= gift.stars);
    const dref = this.dialog.open(GiftDialog, {
      data: {
        title: canBuy.length > 0 ? 'Choose kid:' : 'No kids can buy',
        kids: canBuy,
        buy: (kid: IKid) => {
          kid.addToBag(gift);
          kid.updateStars((-1) * gift.stars);
          this.app.updateKids(kid);
          dref.close();
        }
      }
    });
  }

}
