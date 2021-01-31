import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AppService } from 'src/app/app.service';
import { IGift, IKid, IStateStore } from 'src/app/logic/interfaces';
import { GiftDialogComponent } from 'src/app/dialogs/gift-dialog/gift-dialog.component';
@Component({
  selector: 'app-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit {
  title = 'Summary';
  state: IStateStore;
  constructor(public app: AppService, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.state = this.app.state;
    this.state.kids = this.state.kids.sort((k1, k2) => k2.stars - k1.stars);
  }

  giftclick(gift: IGift, kid: IKid) {
    const ref = this.dialog.open(GiftDialogComponent, { data: {
      actions: [
        { 
            label: 'redeem', 
            click: () => {
              kid.removeFromBag(gift);
              ref.close();
            }
        },
        { 
          label: 'close',
          click: () => {  ref.close(); }
        }
      ],
      gift: gift
    } });
  }
}
