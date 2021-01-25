import { Component, OnInit } from '@angular/core';
import { AppService } from 'src/app/app.service';
import { KidProfile, State } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit {
  title = 'Summary';
  state: State;
  constructor(public app: AppService) { }

  ngOnInit(): void {
    
    this.state = this.app.state;
    this.state.kids = this.state.kids.sort((k1, k2) => k2.stars - k1.stars);
  }

}
