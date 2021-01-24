import { Component, Input, OnInit } from '@angular/core';
import { KidProfile } from 'src/app/logic/interfaces';

@Component({
  selector: 'app-edit-kids',
  templateUrl: './edit-kids.component.html',
  styleUrls: ['./edit-kids.component.scss']
})
export class EditKidsComponent implements OnInit {
  @Input() data: KidProfile[];
  newKid: KidProfile;
  constructor() { }
  add(newKid: KidProfile) {
    this.data.push(newKid);
    this.reset();
  }

  ngOnInit(): void {
    this.reset();
  }

  get invalidName(): boolean {
    const display = this.newKid.display;
    return (!display) || this.data.some(d => d.display === display);
  }

  reset( ){
    this.newKid = {
        bag: [],
        display: '',
        stars: 0,
        image: 'https://picsum.photos/200?random=' + Math.floor(Math.random() * 100)
    };
  }

  delete(index: number) {
    this.data.splice(index, 1);
  }

}
