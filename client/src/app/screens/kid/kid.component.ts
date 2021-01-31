import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppService } from 'src/app/app.service';
import { IKid } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-kid',
  templateUrl: './kid.component.html',
  styleUrls: ['./kid.component.scss']
})
export class KidComponent implements OnInit {
  kid: IKid;
  constructor(private route: ActivatedRoute, private app: AppService) { }
  rate(r: number) {
    this.kid.updateStars(r);
    this.app.updateKids(this.kid);
  }
  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.kid = this.app.state.kids.find((k: IKid) => k.id === id);
  }

}
