import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppService } from 'src/app/app.service';
import { Gift } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-store',
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit {
  gifts: Gift[];
  title: string;
  kid: string;
  constructor(private app: AppService, private route: ActivatedRoute) { 
    this.kid = this.route.snapshot.params['kid'];
    this.title = `Welcome ${this.kid} !`;
  }

  ngOnInit(): void {
    this.gifts = this.app.state.gifts;
  }

}
