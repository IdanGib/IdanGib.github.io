import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Gift, KidProfile } from 'src/app/logic/interfaces';
export interface GiftDialogData {
  actions: { label: string, click: (gift: Gift) => void }[],
  gift: Gift;
}
@Component({
  selector: 'app-gift-dialog',
  templateUrl: './gift-dialog.component.html',
  styleUrls: ['./gift-dialog.component.scss']
})
export class GiftDialogComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<GiftDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GiftDialogData) { }

  ngOnInit(): void {
  }

}
