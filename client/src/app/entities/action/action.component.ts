import { Component, Input, OnInit } from '@angular/core';
import { IAppAction } from 'src/app/logic/actions/actions.state';

@Component({
  selector: 'app-action',
  templateUrl: './action.component.html',
  styleUrls: ['./action.component.scss']
})
export class ActionComponent<T> implements OnInit {
  @Input() action: IAppAction<T>;
  @Input() payload: T;
  @Input() icon: string;
  constructor() { }

  ngOnInit(): void {
  }

}
