import { Component, Inject, Input, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Gift } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-gift',
  templateUrl: './gift.component.html',
  styleUrls: ['./gift.component.scss']
})
export class GiftComponent implements OnInit {
  @Input() gift: Gift;
  @Input() isListItem: boolean = false;
  constructor() { }

  ngOnInit(): void {
    this.gift = this.gift;
  }
}
