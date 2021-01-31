import { Component, OnInit } from '@angular/core';
declare const Tesseract: any;
@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit {
  text: string;
  constructor() { }

  ngOnInit(): void {
  }

  progress: number;

  image(image: string) {
    Tesseract.recognize(
      image,
      'eng',
      { 
        logger: (m: any) => {
          this.progress = m.progress;
        } 
    }
    ).then(({ data: { text } }) => {
      this.text = text;
    })

  }

}
