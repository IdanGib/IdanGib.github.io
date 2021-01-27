import { AfterViewInit, Component, ElementRef, 
  Input, OnDestroy, OnInit, ViewChild } from '@angular/core';

declare const Tesseract: any;

@Component({
  selector: 'app-take-photo',
  templateUrl: './take-photo.component.html',
  styleUrls: ['./take-photo.component.scss']
})
export class TakePhotoComponent implements OnInit, AfterViewInit, OnDestroy {
  private _size: number;
  text: string;
  @Input() isProfile: boolean;
  @Input() set maxSize(s: number) {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    this._size = Math.min(vw, vh, s);
  }

  @ViewChild('v') videoRef: ElementRef;
  @ViewChild('c') canvasRef: ElementRef;

  stream: MediaStream;
  photo: string;
  constructor() {}

  progress: number;

  ngOnInit(): void {
   
  }
  async getMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    let stream = null;
  
    try {
      this.close();
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      /* use the stream */
    } catch(err) {
      /* handle the error */
    }
    return stream;
  }

  getSize(w: number, h: number): { w: number, h: number } {
    const max = Math.max(w, h);
    const s = this._size;
    if( max > s) {
      const min = Math.min(w, h);
      const sr = s * (min / max);
      return (max === w) ? { w: s, h: sr } : { w: sr, h: s };
    }
    return { w, h };
  }

  takePhoto(video: HTMLVideoElement) {
    this.progress = 0;
    this.text = null;
    const canvas: HTMLCanvasElement = this.canvasRef.nativeElement;
    const size = this.getSize(video.videoWidth, video.videoHeight);
    canvas.width = size.w;
    canvas.height = size.h;
    canvas.getContext("2d").drawImage(video, 0, 0, size.w, size.h);
    var img = canvas.toDataURL("image/png");
    this.photo = img;
    this.close();
  }

  detecText(img: string) {
    if(!img) {
      return;
    }
    Tesseract.recognize(
      img,
      'eng',
      { logger: (m: any) => {
        this.progress = Math.floor(100 * m.progress); 
      } }
    ).then(({ data: { text } }) => {
      console.log(text);
      this.text = text;
    }).catch((err: any) => {
      console.error(err);
    });
  }

  dismiss() {
    this.progress = 0;
    this.text = null;
    this.photo = null;
    this.close();
    this.open();
  }
  async open() {
    console.log('open camera');
    const video: HTMLVideoElement = this.videoRef.nativeElement;
    video.srcObject = null;
    const device = await this.getVideoDevice();
    const deviceId = device.deviceId;
    if(deviceId) {
      this.stream = await this.getMedia({ video: { /*facingMode: "user",*/ deviceId  } });
      if(this.stream) {
        video.onplaying = () => {
          const size = this.getSize(video.videoWidth, video.videoHeight);
          video.width = size.w;
          video.height = size.h;
        };
        video.srcObject = this.stream;
      }
    }

  }
  close() {
    this.stream?.getTracks().forEach(t => t.stop());
  }

  ngAfterViewInit() {
    this.open();
  }

  async getVideoDevice(): Promise<MediaDeviceInfo> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return null;
    }
    
    // List cameras and microphones.
    
    return navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      for(let device of devices) {
        if(device.kind === 'videoinput') {
          return device;
        }
      }
      return null;
    })
    .catch((err) => {
      console.log(err.name + ": " + err.message);
      return null;
    });
  }
  ngOnDestroy() {
    this.close();
  }
}
