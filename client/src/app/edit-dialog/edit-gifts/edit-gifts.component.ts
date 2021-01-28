import { Component, Input, OnInit } from '@angular/core';
import { AppService } from 'src/app/app.service';

@Component({
  selector: 'app-edit-gifts',
  templateUrl: './edit-gifts.component.html',
  styleUrls: ['./edit-gifts.component.scss']
})
export class EditGiftsComponent implements OnInit {
  @Input() data: any;
  constructor(private app: AppService) { }

  ngOnInit(): void {
    this.data = this.data || this.app.state.gifts;
  }


}
