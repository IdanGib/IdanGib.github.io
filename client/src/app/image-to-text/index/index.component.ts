import { Component, OnInit } from '@angular/core';
declare const Tesseract: any;
@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit {
  text: string;
  lang = 'eng';
  langs = [ {val: 'eng', label: 'English'}, { val: 'heb', label: 'Hebrew'} ];
  constructor() { }
  imageUrl = '';
  ngOnInit(): void {
  }

  progress: number;

  image(image: string) {
    Tesseract.recognize(
      image,
      this.lang,//'eng+heb',
      { 
        logger: (m: any) => {
          this.progress = m.progress;
        } 
      }
    ).then((res: any) => {
      console.log(res);
      this.text = res.data.text;
    })

  }

}
