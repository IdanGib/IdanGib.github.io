import { Component, Input, OnInit } from '@angular/core';
import { AppService } from 'src/app/app.service';
import { IProfile } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss']
})
export class EditProfileComponent implements OnInit {
  @Input() data: IProfile;
  constructor(private app: AppService) { }

  ngOnInit(): void {
    this.data = this.data || this.app.state.profile;
  }

}
