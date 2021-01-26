import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
const MAX_VIDEO_SIZE = 300;
@Component({
  selector: 'app-take-photo',
  templateUrl: './take-photo.component.html',
  styleUrls: ['./take-photo.component.scss']
})
export class TakePhotoComponent implements OnInit, AfterViewInit {
  @ViewChild('v') videoRef: ElementRef;
  @ViewChild('c') canvasRef: ElementRef;

  stream: MediaStream;
  photo: string;
  constructor() { }

  ngOnInit(): void {
    this.open();
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
    const s = MAX_VIDEO_SIZE;
    if( max > s) {
      const min = Math.min(w, h);
      const sr = s * (min / max);
      return (max === w) ? { w: s, h: sr } : { w: sr, h: s };
    }
    return { w, h };
  }

  takePhoto(video: HTMLVideoElement) {
    const canvas: HTMLCanvasElement = this.canvasRef.nativeElement;
    const size = this.getSize(video.videoWidth, video.videoHeight);
    canvas.width = size.w;
    canvas.height = size.h;
    canvas.getContext("2d").drawImage(video, 0, 0, size.w, size.h);
    var img = canvas.toDataURL("image/png");
    this.photo = img;
    this.close();
  }
  dismiss() {
    this.photo = null;
    this.close();
    this.open();
  }
  async open() {
    const deviceId = await this.getVideoDeviceId();
    this.stream = await this.getMedia({ video: { facingMode: "user", deviceId  } });
    const video: HTMLVideoElement = this.videoRef.nativeElement;
    video.onplaying = () => {
      const size = this.getSize(video.videoWidth, video.videoHeight);
      video.width = size.w;
      video.height = size.h;
    };
    video.srcObject = this.stream;
  }
  close() {
    this.stream?.getTracks().forEach(t => t.stop());
  }

  ngAfterViewInit() {
    
  }

  async getVideoDeviceId(): Promise<string> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.log("enumerateDevices() not supported.");
      return Promise.reject(null);
    }
    
    // List cameras and microphones.
    
    return navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      devices.forEach((device) => {
        if(device.kind === 'videoinput') {
          return Promise.resolve(device.deviceId);
        }
      });
    })
    .catch((err) => {
      console.log(err.name + ": " + err.message);
      return null;
    });
  }

}
