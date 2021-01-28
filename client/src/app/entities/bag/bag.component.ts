import { Component, Input, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { Gift, KidProfile } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-bag',
  templateUrl: './bag.component.html',
  styleUrls: ['./bag.component.scss']
})
export class BagComponent implements OnInit {
  @Input() toggle: boolean;
  @Input() kid: KidProfile;
  @Output() giftClick = new Subject<Gift>();
  constructor() { }
  toggleBag(event: any) {
    this.toggle = !this.toggle;
    event?.stopPropagation();
  }
  ngOnInit(): void {
  }

}
