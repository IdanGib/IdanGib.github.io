import { Component, Input, OnInit } from '@angular/core';
import { IGift } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-gift',
  templateUrl: './gift.component.html',
  styleUrls: ['./gift.component.scss']
})
export class GiftComponent implements OnInit {
  @Input() gift: IGift;
  @Input() isListItem: boolean = false;
  constructor() { }

  ngOnInit(): void {
    this.gift = this.gift;
  }
}
