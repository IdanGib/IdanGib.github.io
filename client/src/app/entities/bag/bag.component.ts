import { Component, Input, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { IGift, IKidProfile } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-bag',
  templateUrl: './bag.component.html',
  styleUrls: ['./bag.component.scss']
})
export class BagComponent implements OnInit {
  @Input() toggle: boolean;
  @Input() kid: IKidProfile;
  @Output() giftClick = new Subject<IGift>();
  constructor() { }
  toggleBag(event: any) {
    this.toggle = !this.toggle;
    event?.stopPropagation();
  }
  ngOnInit(): void {
  }

}
