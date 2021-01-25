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

  getSize(w: number, h: number): { w: number, h: number } {
    const r = (h / w);
    const size = 300;
    return { w: size, h: (r * size) };
  }

  takePhoto(video: HTMLVideoElement) {
    const canvas: HTMLCanvasElement = this.canvasRef.nativeElement;
    const size = this.getSize(video.videoWidth, video.videoHeight);
    canvas.width = size.w;
    canvas.height = size.h;
    canvas.getContext("2d").drawImage(video, 0, 0, size.w, size.h);
    var img = canvas.toDataURL("image/png");
    console.log(img);
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
    console.log(video);
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
