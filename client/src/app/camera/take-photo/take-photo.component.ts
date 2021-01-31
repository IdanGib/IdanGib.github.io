import { AfterViewInit, Component, ElementRef, 
  Inject, 
  Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { MatBottomSheet, MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA} from '@angular/material/bottom-sheet';

@Component({
  selector: 'bottom-sheet-chooser',
  template: `
    <div class="wrapper">
      <button *ngFor="let device of data.devices" mat-button (click)="choose(device)">
        {{ device.label || 'Unknown' }}
      </button>
    <div>
  `,
  styles: [`
    .wrapper {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-evenly;
    }
  `]
})
export class BottomSheetDevicesChooser {

  constructor(private _bottomSheetRef: MatBottomSheetRef<BottomSheetDevicesChooser>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: { devices: MediaDeviceInfo[] } ) {}
  choose(device: MediaDeviceInfo): void {
    this._bottomSheetRef.dismiss(device);
  }
}


@Component({
  selector: 'app-take-photo',
  templateUrl: './take-photo.component.html',
  styleUrls: ['./take-photo.component.scss']
})
export class TakePhotoComponent implements OnInit, AfterViewInit, OnDestroy {
  private _size: number;
  profile: boolean;
  @Output() image = new Subject<string>();
  @Input() isProfile: boolean;
  @Input() set maxSize(s: number) {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    this._size = Math.min(vw, vh, s);
  }
  @ViewChild('v') videoRef: ElementRef;
  @ViewChild('c') canvasRef: ElementRef;
  @ViewChild('image') imgRef: ElementRef;
  err: string;
  stream: MediaStream;
  photo: string;
  constructor(private _bottomSheet: MatBottomSheet) {}



  ngOnInit(): void {
    this.maxSize = this._size || 300;
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
    const canvas: HTMLCanvasElement = this.canvasRef.nativeElement;
    
    const vWidth = video.videoWidth;
    const vHight = video.videoHeight;

    const size = this.getSize(vWidth, vHight);
    
    canvas.width = vWidth;
    canvas.height = vHight;

    canvas.getContext("2d").drawImage(video, 0, 0, vWidth, vHight);
    var img = canvas.toDataURL("image/png");
    this.photo = img;
    const image: HTMLImageElement = this.imgRef.nativeElement;
    image.width = size.w;
    image.height = size.h;
    this.close();
  }

  dismiss() {
    this.photo = null;
    this.close();
    this.open();
  }

  approve() {
    if(this.photo) {
      this.image.next(this.photo);
    }
  }

  async chooseDevice(devices: MediaDeviceInfo[]): Promise<MediaDeviceInfo> {
    const bref = this._bottomSheet.open(BottomSheetDevicesChooser, {
      data: { devices }
    });
    return bref.afterDismissed().toPromise();
  }

  async open() {
    const video: HTMLVideoElement = this.videoRef.nativeElement;
    video.srcObject = null;
    const devices = await this.getDevices('videoinput');

    const device = devices.length > 1 ? await this.chooseDevice(devices) : devices[0];

    const deviceId = device?.deviceId;
    
    if(deviceId) {
      this.stream = await this.getMedia({ video: { 
          deviceId: { exact: deviceId } 
        }
      });
      if(this.stream) {
        video.onplaying = () => {
          const size = this.getSize(video.videoWidth, video.videoHeight);
          video.width = size.w;
          video.height = size.h;
        };
        video.srcObject = this.stream;
      }
    } else {
      this.err = 'device not found';
    }

  }
  close() {
    this.stream?.getTracks().forEach(t => t.stop());
  }

  ngAfterViewInit() {
    this.maxSize = this._size || 300;
    this.open();
  }

  async getDevices(kind: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
    const redult: MediaDeviceInfo[] = [];
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return redult;
    }
    
    // List cameras and microphones.
    
    return navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      for(let device of devices) {
        if(device.kind === kind) {
          redult.push(device);
        }
      }
      return redult;
    })
    .catch((err) => {
      console.log(err.name + ": " + err.message);
      return redult;
    });
  }
  ngOnDestroy() {
    this.close();
  }
}
