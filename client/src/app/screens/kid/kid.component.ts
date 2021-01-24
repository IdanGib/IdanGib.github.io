import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppService } from 'src/app/app.service';
import { KidProfile } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-kid',
  templateUrl: './kid.component.html',
  styleUrls: ['./kid.component.scss']
})
export class KidComponent implements OnInit {
  kid: KidProfile;
  constructor(private route: ActivatedRoute, private app: AppService) { }
  rate(r: number) {
    this.kid.stars += r;
    this.app.saveState();
  }
  ngOnInit(): void {
    const display = this.route.snapshot.params['id'];
    this.kid = this.app.state.kids.find(k => k.display === display);
  }

}
