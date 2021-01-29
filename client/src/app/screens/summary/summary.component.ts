import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AppService } from 'src/app/app.service';
import { GiftDialogData } from 'src/app/dialogs/gift-dialog/gift-dialog.component';
import { Gift, KidProfile, State } from 'src/app/logic/interfaces';
import { GiftDialog } from '../store/store.component';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit {
  title = 'Summary';
  state: State;
  constructor(public app: AppService, private dialog: MatDialog) { }

  ngOnInit(): void {
    
    this.state = this.app.state;
    this.state.kids = this.state.kids.sort((k1, k2) => k2.stars - k1.stars);
  }

  giftclick(gift: Gift, kid: KidProfile) {
    const ref = this.dialog.open(GiftDialog, { data: {
      actions: [
        { label: 'redeem', click: () => {
            
        }},
        { label: 'close', click: () => {
          ref.close();
        }}
      ],
      gift: gift
    } })
  }
}
