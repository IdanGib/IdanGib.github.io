import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppService } from 'src/app/app.service';
import { UpdateKidStarsAction } from 'src/app/logic/actions/actions.state';
import { IKid } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-kid',
  templateUrl: './kid.component.html',
  styleUrls: ['./kid.component.scss']
})
export class KidComponent implements OnInit {
  kid: IKid;
  public updateStars = this.app.UpdateKidStarsAction;
  constructor(private route: ActivatedRoute, 
    public app: AppService) {}
  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.kid = this.app.state.kids.find((k: IKid) => k.id === id);
  }

}
