import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-kid-dialog',
  templateUrl: './kid-dialog.component.html',
  styleUrls: ['./kid-dialog.component.scss']
})
export class KidDialogComponent implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<KidDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit(): void {
  }

}
