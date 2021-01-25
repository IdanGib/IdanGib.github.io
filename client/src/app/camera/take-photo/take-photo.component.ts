import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-take-photo',
  templateUrl: './take-photo.component.html',
  styleUrls: ['./take-photo.component.scss']
})
export class TakePhotoComponent implements OnInit, AfterViewInit {
  @ViewChild('v') videoRef: ElementRef;
  @ViewChild('c') canvasRef: ElementRef;

  stream: MediaStream;

  constructor() { }

  ngOnInit(): void {
    
  }
  async getMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    let stream = null;
  
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      /* use the stream */
    } catch(err) {
      /* handle the error */
    }
    return stream;
  }

  takePhoto(video: HTMLVideoElement) {
    const canvas: HTMLCanvasElement = this.canvasRef.nativeElement;
    canvas.getContext("2d").drawImage(video, 0, 0, 300, 300);
    var img = canvas.toDataURL("image/png");
    console.log(img);
  }

  async open() {
    this.stream = await this.getMedia({ video: { facingMode: "user" } });
    const video: HTMLVideoElement = this.videoRef.nativeElement;
    video.srcObject = this.stream;
  }
  close() {
    this.stream?.getTracks().forEach(t => t.stop());
  }

  ngAfterViewInit() {
  
  }
}
