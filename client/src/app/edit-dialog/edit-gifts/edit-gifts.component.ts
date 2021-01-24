import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-edit-gifts',
  templateUrl: './edit-gifts.component.html',
  styleUrls: ['./edit-gifts.component.scss']
})
export class EditGiftsComponent implements OnInit {
  @Input() data: any;
  constructor() { }

  ngOnInit(): void {
  }

}
