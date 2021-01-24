import { Component, Input, OnInit } from '@angular/core';
import { Profile } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss']
})
export class EditProfileComponent implements OnInit {
  @Input() data: Profile;
  constructor() { }

  ngOnInit(): void {
  }

}
